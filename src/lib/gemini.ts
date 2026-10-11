import { GEMINI_BASE_URL, GEMINI_TIMEOUT_MS } from "./config";
import { cleanStr, toUnit } from "./lesson";
import type { GradeResult } from "./types";

/** Model có generateContent nhưng không dùng cho văn bản (đọc giọng nói, tạo ảnh...). */
const NON_TEXT_MARKERS = ["tts", "image", "audio", "embedding", "robotics", "computer-use", "live", "deep-research", "antigravity"];

export class GeminiError extends Error {}
/** Model có trong danh sách generateContent nhưng API chỉ cho gọi qua Interactions API. */
export class UnsupportedModelError extends GeminiError {}

function explain(status: number, message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
    return "API key không hợp lệ. Kiểm tra xem đã sao chép đủ cả key chưa.";
  }
  if (status === 429) return "Đã hết lượt gọi miễn phí trong lúc này. Đợi khoảng một phút rồi thử lại.";
  if (status === 403) return `Key này chưa được phép dùng Gemini API (${message || "403"}).`;
  if (status === 404) {
    return `Không tìm thấy model hoặc key không dùng được model này. Chọn model khác trong Cài đặt. (${message})`;
  }
  if (status >= 500) return "Máy chủ Gemini đang bận. Thử lại sau ít phút.";
  return message || `Gemini trả về lỗi ${status}.`;
}

interface ApiError {
  error?: { message?: string };
}
interface ModelList {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
  nextPageToken?: string;
}
interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

async function request<T>(url: string, apiKey: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const stopped = () => {
    if (timeout.aborted) return new GeminiError(`Gemini không trả lời sau ${GEMINI_TIMEOUT_MS / 1000} giây. Thử lại.`);
    return init.signal?.aborted ? new GeminiError("Đã huỷ yêu cầu.") : null;
  };
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    });
  } catch {
    throw stopped() ?? new GeminiError("Không kết nối được tới Gemini. Kiểm tra lại mạng.");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    const error = stopped();
    if (error) throw error;
    data = null;
  }
  const message = cleanStr((data as ApiError | null)?.error?.message);
  if (message.toLowerCase().includes("interactions api")) {
    throw new UnsupportedModelError("Model này chỉ chạy qua Interactions API, trang không dùng được. Chọn model khác trong Cài đặt.");
  }
  if (!response.ok) throw new GeminiError(explain(response.status, cleanStr((data as ApiError | null)?.error?.message)));
  return data as T;
}

export async function listTextModels(apiKey: string): Promise<string[]> {
  const names = new Set<string>();
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await request<ModelList>(`${GEMINI_BASE_URL}/models?${query}`, apiKey);
    for (const model of data?.models ?? []) {
      const name = cleanStr(model.name).replace(/^models\//, "");
      if (!name || !model.supportedGenerationMethods?.includes("generateContent")) continue;
      if (NON_TEXT_MARKERS.some((marker) => name.includes(marker))) continue;
      names.add(name);
    }
    pageToken = cleanStr(data?.nextPageToken);
  } while (pageToken);
  return [...names].sort((a, b) => {
    const rank = (n: string) => (n.startsWith("gemini-") ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

export async function generate(
  apiKey: string,
  model: string,
  prompt: string,
  { json = false, signal }: { json?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
  const data = await request<GenerateResponse>(url, apiKey, { method: "POST", body: JSON.stringify(body), signal });
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "") // không cắt khoảng trắng từng phần, kẻo chữ dính nhau
    .join("")
    .trim();
  if (!text) {
    const reason = data?.promptFeedback?.blockReason || candidate?.finishReason || "không rõ lý do";
    throw new GeminiError(`Gemini không trả về nội dung (${reason}). Thử lại hoặc sửa bài làm.`);
  }
  return text;
}

function parseJson(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1);
  return JSON.parse(cleaned);
}

/** Mã mắt xích -> câu hỏi. Bỏ qua phần tử thiếu mã hoặc nội dung. */
export function parseChallenges(raw: string): Map<string, string> {
  const data = parseJson(raw);
  const items = Array.isArray(data) ? data : (data as { cau_hoi?: unknown } | null)?.cau_hoi;
  if (!Array.isArray(items)) throw new Error("Danh sách câu hỏi không đúng định dạng.");
  const questions = new Map<string, string>();
  for (const item of items as { id?: unknown; noi_dung?: unknown }[]) {
    const id = cleanStr(item?.id).replace(/^\[|\]$/g, "");
    const text = cleanStr(item?.noi_dung);
    if (id && text) questions.set(id, text);
  }
  return questions;
}

export function parseGrade(raw: string): GradeResult {
  let data = parseJson(raw);
  if (Array.isArray(data)) data = data[0];
  if (!data || typeof data !== "object") throw new Error("Kết quả chấm không phải đối tượng JSON.");
  const d = data as Record<string, unknown>;
  const noi_dia = toUnit(d.noi_dia, 0);
  const quoc_te = toUnit(d.quoc_te, 0);
  const hoa_giai = toUnit(d.hoa_giai, 0);
  return {
    noi_dia,
    quoc_te,
    hoa_giai,
    trs: (noi_dia + quoc_te + hoa_giai) / 3,
    nhan_xet: cleanStr(d.nhan_xet),
    goi_y: cleanStr(d.goi_y_chien_luoc),
  };
}
