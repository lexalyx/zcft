import { DEFAULT_GEMINI_MODEL, EMBED_MODELS } from "./config";
import { generate, GeminiError, listTextModels, parseChallenges, UnsupportedModelError } from "./gemini";
import { fingerprint } from "./lesson";
import { challengesPrompt } from "./prompts";
import { onModelProgress } from "./retrieval";
import { propagateRisk, riskyNodes } from "./risk";
import * as storage from "./storage";
import type { LegalDoc, Lesson, NodeWork } from "./types";

export const errorMessage = (exc: unknown): string => (exc instanceof Error ? exc.message : String(exc));

class Settings {
  apiKey = $state(storage.load("apiKey", "") || storage.load("apiKey", "", "session"));
  rememberKey = $state(Boolean(storage.load("apiKey", "")));
  model = $state(storage.load("model", DEFAULT_GEMINI_MODEL));
  /** Id trong EMBED_MODELS, hoặc "" để tìm theo từ ngữ (TF-IDF). */
  embedModelId = $state(storage.load("embedModel", storage.load("semantic", true) ? EMBED_MODELS[0].id : ""));
  embedModel = $derived(EMBED_MODELS.find((m) => m.id === this.embedModelId));
  models = $state<string[]>([]);
  /** Model đã trả lỗi “only supports Interactions API”; không đưa vào danh sách chọn nữa. */
  blockedModels = $state<string[]>(storage.load("blockedModels", []));
  keyStatus = $state<{ text: string; kind: "" | "ok" | "error" }>({ text: "", kind: "" });

  setApiKey(key: string, remember: boolean): void {
    this.apiKey = key.trim();
    this.rememberKey = remember;
    storage.remove("apiKey");
    storage.remove("apiKey", "session");
    if (this.apiKey) storage.save("apiKey", this.apiKey, remember ? "local" : "session");
    if (!this.apiKey) {
      this.models = [];
      this.keyStatus = { text: "", kind: "" };
    }
  }

  blockModel(model: string): void {
    if (!this.blockedModels.includes(model)) this.blockedModels.push(model);
    storage.save("blockedModels", $state.snapshot(this.blockedModels));
    this.models = this.models.filter((m) => m !== model);
    if (this.model === model) this.setModel(this.models.includes(DEFAULT_GEMINI_MODEL) ? DEFAULT_GEMINI_MODEL : (this.models[0] ?? ""));
  }

  setModel(model: string): void {
    this.model = model.trim() || DEFAULT_GEMINI_MODEL;
    storage.save("model", this.model);
  }

  setEmbedModel(id: string): void {
    this.embedModelId = id;
    storage.save("embedModel", id);
  }

  async verifyKey(): Promise<boolean> {
    if (!this.apiKey) {
      this.keyStatus = { text: "Chưa nhập key.", kind: "error" };
      return false;
    }
    this.keyStatus = { text: "Đang kiểm tra key…", kind: "" };
    try {
      const models = (await listTextModels(this.apiKey)).filter((m) => !this.blockedModels.includes(m));
      this.models = models;
      if (models.length && !models.includes(this.model)) {
        this.setModel(models.includes(DEFAULT_GEMINI_MODEL) ? DEFAULT_GEMINI_MODEL : models[0]);
      }
      this.keyStatus = { text: `Key dùng được. Có ${models.length} model để chọn.`, kind: "ok" };
      return true;
    } catch (exc) {
      this.keyStatus = { text: errorMessage(exc), kind: "error" };
      return false;
    }
  }
}

export const settings = new Settings();

class SettingsDialogState {
  open = $state(false);
  note = $state("");

  show(note = ""): void {
    this.note = note;
    this.open = true;
  }
}

export const settingsDialog = new SettingsDialogState();

export async function askGemini(prompt: string, options: { json?: boolean; signal?: AbortSignal } = {}): Promise<string> {
  const model = settings.model;
  try {
    return await generate(settings.apiKey, model, prompt, options);
  } catch (exc) {
    if (!(exc instanceof UnsupportedModelError)) throw exc;
    settings.blockModel(model);
    throw new GeminiError(`Model ${model} chỉ chạy qua Interactions API nên đã bị bỏ khỏi danh sách. Đã chuyển sang ${settings.model}, bấm thử lại.`);
  }
}

export function requireKey(note: string): boolean {
  if (settings.apiKey) return true;
  settingsDialog.show(note);
  return false;
}

export const LOCAL_PREFIX = "local:";

export interface SavedLesson {
  id: string;
  lesson: Lesson;
  warnings: string[];
}

class Library {
  entries = $state<SavedLesson[]>(storage.load("library", []));

  add(lesson: Lesson, warnings: string[]): string {
    const id = fingerprint(lesson);
    this.entries = [...this.entries.filter((e) => e.id !== id), { id, lesson, warnings }];
    this.save();
    return id;
  }

  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.save();
  }

  private save(): void {
    storage.save("library", $state.snapshot(this.entries));
  }
}

export const library = new Library();

class Session {
  /** Bài như trong file; `lesson` = bài này cộng `extraDocs`. */
  base = $state<Lesson | null>(null);
  extraDocs = $state<LegalDoc[]>([]);
  lesson = $derived<Lesson | null>(this.base ? { ...this.base, van_ban: [...this.base.van_ban, ...this.extraDocs] } : null);
  warnings = $state<string[]>([]);
  work = $state<Record<string, NodeWork>>({});
  caseText = $state("");
  /** Mã các căn cứ tìm được cho tình huống; null khi chưa phân tích. */
  retrievedIds = $state<string[] | null>(null);
  /** Tăng mỗi lần mở bài hoặc làm lại; kết quả của lượt cũ về muộn thì bỏ. */
  run = 0;
  challengesBusy = $state(false);
  challengesError = $state("");
  private controller = new AbortController();

  /** Bị huỷ khi mở bài khác hoặc làm lại, để yêu cầu Gemini đang chờ không giữ hàng đợi. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  lessonKey = $derived(
    this.base ? fingerprint(this.base.ten_bai, this.base.tinh_huong, this.base.van_ban, this.base.lien_ket) : "",
  );
  report = $derived(
    this.lesson ? propagateRisk(this.lesson.van_ban, this.lesson.lien_ket, this.lesson.settings.alpha) : null,
  );
  nodes = $derived(this.report && this.lesson ? riskyNodes(this.report, this.lesson.settings.threshold) : []);

  private nextRun(): void {
    this.run += 1;
    this.controller.abort();
    this.controller = new AbortController();
    this.challengesBusy = false;
    this.challengesError = "";
  }

  /** Một yêu cầu Gemini cho mọi mắt xích chưa có câu hỏi: key miễn phí chỉ có vài chục lượt gọi mỗi ngày. */
  async fillChallenges(): Promise<void> {
    const lesson = this.lesson;
    if (!lesson || this.retrievedIds === null || !settings.apiKey || this.challengesBusy) return;
    const byId = new Map(lesson.van_ban.map((d) => [d.id, d]));
    const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((d) => d !== undefined);
    const targets = pick(this.nodes.filter((id) => !this.workFor(id).challenge));
    if (!targets.length) return;
    const related = pick(this.retrievedIds);
    const context = [...new Map([...targets, ...related].map((d) => [d.id, d])).values()];
    const run = this.run;
    const model = settings.model;
    this.challengesBusy = true;
    this.challengesError = "";
    try {
      const raw = await askGemini(challengesPrompt(this.caseText, targets, context), { json: true, signal: this.signal });
      if (this.run !== run) return;
      let questions: Map<string, string>;
      try {
        questions = parseChallenges(raw);
      } catch {
        throw new Error("Gemini trả câu hỏi không đúng định dạng. Bấm “Phân tích rủi ro” để thử lại.");
      }
      for (const doc of targets) {
        const text = questions.get(doc.id);
        const contextIds = [doc.id, ...related.filter((d) => d.id !== doc.id).map((d) => d.id)];
        if (text) this.updateWork(doc.id, { challenge: { text, contextIds, model } });
      }
      if (targets.some((d) => !questions.has(d.id))) this.challengesError = "Gemini chưa trả đủ câu hỏi. Bấm “Phân tích rủi ro” để lấy phần còn thiếu.";
    } catch (exc) {
      if (this.run === run) this.challengesError = errorMessage(exc);
    } finally {
      if (this.run === run) this.challengesBusy = false;
    }
  }

  open(lesson: Lesson, warnings: string[]): void {
    this.nextRun();
    this.base = lesson;
    this.warnings = warnings;
    const ids = new Set(lesson.van_ban.map((d) => d.id));
    this.extraDocs = storage.load<LegalDoc[]>(`docs:${this.lessonKey}`, []).filter((d) => !ids.has(d.id));
    this.work = storage.load(`work:${this.lessonKey}`, {});
    const saved = storage.load<{ text?: string; retrievedIds?: string[] | null }>(`case:${this.lessonKey}`, {});
    this.caseText = saved.text ?? lesson.tinh_huong;
    this.retrievedIds = saved.retrievedIds ?? null;
  }

  setCaseText(text: string): void {
    this.caseText = text;
    this.saveCase();
  }

  setRetrieved(ids: string[]): void {
    this.retrievedIds = ids;
    this.saveCase();
  }

  close(): void {
    this.nextRun();
    this.base = null;
  }

  addDoc(doc: LegalDoc): void {
    this.extraDocs.push(doc);
    this.saveDocs();
  }

  removeDoc(id: string): void {
    this.extraDocs = this.extraDocs.filter((d) => d.id !== id);
    this.saveDocs();
  }

  private saveDocs(): void {
    storage.save(`docs:${this.lessonKey}`, $state.snapshot(this.extraDocs));
  }

  reset(): void {
    if (!this.lesson) return;
    this.nextRun();
    this.work = {};
    this.caseText = this.lesson.tinh_huong;
    this.retrievedIds = null;
    storage.remove(`work:${this.lessonKey}`);
    storage.remove(`case:${this.lessonKey}`);
  }

  private saveCase(): void {
    storage.save(`case:${this.lessonKey}`, { text: this.caseText, retrievedIds: $state.snapshot(this.retrievedIds) });
  }

  workFor(docId: string): NodeWork {
    return this.work[docId] ?? {};
  }

  updateWork(docId: string, patch: Partial<NodeWork>): void {
    this.work[docId] = { ...this.workFor(docId), ...patch };
    storage.save(`work:${this.lessonKey}`, $state.snapshot(this.work));
  }
}

export const session = new Session();

class ModelStatus {
  text = $state("");
}

export const modelStatus = new ModelStatus();

onModelProgress(({ loaded, total }) => {
  if (!total) return;
  const mb = (bytes: number) => Math.round(bytes / 1e6);
  modelStatus.text =
    loaded >= total ? "" : `Đang tải mô hình tìm căn cứ: ${mb(loaded)} / ${mb(total)} MB`;
});
