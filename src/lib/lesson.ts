import { DEFAULT_BASE_RISK, DEFAULT_SETTINGS } from "./config";
import type { LegalDoc, Lesson, LessonSettings, RiskLink } from "./types";

type Row = Record<string, unknown>;

export function cleanStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value).trim();
}

export function plain(value: unknown): string {
  return cleanStr(value)
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Đọc số trong khoảng [0, 1]. Chấp nhận 0.7, "0,7", "70%" và 70 (hiểu là 70%). */
export function toUnit(value: unknown, fallback = DEFAULT_BASE_RISK): number {
  let number: number;
  if (typeof value === "number") {
    number = value;
  } else {
    let text = cleanStr(value).replace(",", ".");
    const isPercent = text.endsWith("%");
    if (isPercent) text = text.slice(0, -1).trim();
    if (text === "") return fallback;
    number = Number(text);
    if (isPercent) number /= 100;
  }
  if (!Number.isFinite(number)) return fallback;
  if (number > 1 && number <= 100) number /= 100;
  return Math.min(1, Math.max(0, number));
}

function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const text = cleanStr(value).replace(",", ".");
  const number = Math.round(Number(text));
  if (text === "" || !Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** Lỗi của một văn bản nhập tay, hoặc "" nếu hợp lệ. Mã phải khớp mẫu [ID] mà renderRichText nhận ra. */
export function docError(id: string, text: string, takenIds: Iterable<string>): string {
  const code = id.trim();
  if (!code || !text.trim()) return "Nhập mã và nội dung của từng văn bản.";
  if (!/^[A-Za-z0-9_.-]+$/.test(code)) return `Mã ${code}: viết liền, chỉ gồm chữ không dấu, số và gạch dưới (ví dụ VN_BLLD_107).`;
  if ([...takenIds].includes(code)) return `Mã ${code} bị trùng.`;
  return "";
}

export function normalizeDocs(rows: Row[]): { docs: LegalDoc[]; warnings: string[] } {
  const docs: LegalDoc[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const id = cleanStr(row.id);
    const text = cleanStr(row.text);
    if (!id && !text) return;
    const where = `dòng ${index + 2}`;
    if (!id || !text) {
      warnings.push(`Trang "Văn bản", ${where}: thiếu mã hoặc nội dung nên bị bỏ qua.`);
      return;
    }
    if (seen.has(id)) {
      warnings.push(`Trang "Văn bản", ${where}: mã ${id} bị trùng, chỉ giữ dòng đầu tiên.`);
      return;
    }
    seen.add(id);
    docs.push({ id, jurisdiction: cleanStr(row.jurisdiction), text, rui_ro: toUnit(row.rui_ro) });
  });
  return { docs, warnings };
}

export function normalizeLinks(rows: Row[], validIds: Set<string>): { links: RiskLink[]; warnings: string[] } {
  const links: RiskLink[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const nguon = cleanStr(row.nguon);
    const dich = cleanStr(row.dich);
    if (!nguon && !dich) return;
    const missing = [nguon, dich].filter((id) => !validIds.has(id));
    if (missing.length) {
      warnings.push(
        `Trang "Liên kết", dòng ${index + 2}: mã ${missing.map((m) => m || "(trống)").join(", ")} ` +
          `không có trong trang "Văn bản" nên liên kết bị bỏ qua.`,
      );
      return;
    }
    const pair = `${nguon}\u0000${dich}`;
    if (nguon === dich || seen.has(pair)) return;
    seen.add(pair);
    links.push({ nguon, dich, quan_he: cleanStr(row.quan_he) });
  });
  return { links, warnings };
}

export function normalizeSettings(raw: Row | undefined): LessonSettings {
  return {
    threshold: toUnit(raw?.threshold, DEFAULT_SETTINGS.threshold),
    alpha: toUnit(raw?.alpha, DEFAULT_SETTINGS.alpha),
    topK: toInt(raw?.topK, DEFAULT_SETTINGS.topK, 1, 10),
  };
}

export interface RawLesson {
  ten_bai?: unknown;
  tinh_huong?: unknown;
  van_ban?: Row[];
  lien_ket?: Row[];
  settings?: Row;
}

export function normalizeLesson(raw: RawLesson): { lesson: Lesson; warnings: string[] } {
  const { docs, warnings: docWarnings } = normalizeDocs(raw.van_ban ?? []);
  const { links, warnings: linkWarnings } = normalizeLinks(raw.lien_ket ?? [], new Set(docs.map((d) => d.id)));
  const warnings = [...docWarnings, ...linkWarnings];
  if (!docs.length) warnings.unshift('Bài học chưa có văn bản nào trong trang "Văn bản".');
  return {
    lesson: {
      ten_bai: cleanStr(raw.ten_bai) || "Bài học chưa đặt tên",
      tinh_huong: cleanStr(raw.tinh_huong),
      van_ban: docs,
      lien_ket: links,
      settings: normalizeSettings(raw.settings),
    },
    warnings,
  };
}

/** Mã băm ngắn, ổn định (FNV-1a), dùng làm khoá lưu bài làm trong trình duyệt. */
export function fingerprint(...parts: unknown[]): string {
  const text = JSON.stringify(parts);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
