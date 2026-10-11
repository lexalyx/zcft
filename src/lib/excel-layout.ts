/** Dùng chung cho trình đọc trong trang và scripts/make-template.ts. */
import { plain } from "./lesson";

export const SHEETS = {
  info: "Thông tin",
  docs: "Văn bản",
  links: "Liên kết",
  guide: "Hướng dẫn",
} as const;

/** Trang "Thông tin": cột A là mục, cột B là nội dung, cột C là ghi chú. */
export const INFO_ROWS = {
  ten_bai: "Tên bài",
  tinh_huong: "Tình huống",
  threshold: "Ngưỡng rủi ro",
  alpha: "Hệ số lan truyền",
  topK: "Số căn cứ đưa cho AI",
} as const;

export const DOC_HEADERS = ["Mã", "Phạm vi", "Nội dung tóm tắt", "Rủi ro gốc (0–1)"] as const;
export const LINK_HEADERS = ["Từ văn bản", "Tới văn bản", "Quan hệ / cơ chế lan truyền"] as const;

export const GUIDE: [string, string][] = [
  ["Bài học gồm ba trang", "Thông tin, Văn bản, Liên kết. Không đổi tên ba trang này và không đổi dòng tiêu đề của bảng."],
  ["Trang Thông tin", "Điền tên bài và tình huống ở cột B. Ba dòng cài đặt bên dưới có thể để nguyên."],
  ["Ngưỡng rủi ro", "Văn bản có mức rủi ro (sau lan truyền) từ ngưỡng này trở lên sẽ thành mắt xích để sinh viên phản biện. Từ 0 đến 1."],
  ["Hệ số lan truyền", "0 nghĩa là chỉ dùng rủi ro gốc. Càng gần 1 thì rủi ro truyền qua liên kết càng mạnh."],
  ["Số căn cứ đưa cho AI", "Ngoài văn bản đang xét, AI được đưa thêm bấy nhiêu văn bản liên quan nhất với tình huống. Từ 1 đến 10."],
  ["Trang Văn bản", "Mỗi dòng là một văn bản hoặc điều khoản. Mã phải khác nhau, viết liền không dấu (ví dụ VN_BLLD_107)."],
  ["Rủi ro gốc", "Mức bạn đánh giá văn bản này bị vi phạm hoặc tranh chấp trong tình huống, từ 0 đến 1. Có thể gõ 0,7 hoặc 70%."],
  ["Trang Liên kết", "Rủi ro của văn bản ở cột “Từ văn bản” sẽ truyền sang văn bản ở cột “Tới văn bản”. Chọn mã từ danh sách thả xuống."],
  ["Xem thử", "Mở trang web, bấm “Mở file Excel” và chọn file này. Trang sẽ báo nếu file có dòng sai."],
];

export type SheetKind = "info" | "docs" | "links";

export function sheetKind(name: string): SheetKind | null {
  const n = plain(name);
  if (n.includes("thong tin") || n.includes("tinh huong")) return "info";
  if (n.includes("van ban") || n.includes("can cu")) return "docs";
  if (n.includes("lien ket")) return "links";
  return null;
}

export function docColumn(header: string): "id" | "jurisdiction" | "text" | "rui_ro" | null {
  const h = plain(header);
  if (h === "ma" || h.startsWith("ma ") || h === "id") return "id";
  if (h.includes("pham vi") || h.includes("quoc gia") || h.includes("he thong")) return "jurisdiction";
  if (h.includes("noi dung") || h.includes("tom tat") || h === "text") return "text";
  if (h.includes("rui ro")) return "rui_ro";
  return null;
}

export function linkColumn(header: string): "nguon" | "dich" | "quan_he" | null {
  const h = plain(header);
  if (h === "tu" || h.startsWith("tu ") || h.includes("nguon")) return "nguon";
  if (h.startsWith("toi") || h.startsWith("den") || h.includes("dich")) return "dich";
  if (h.includes("quan he") || h.includes("co che") || h.includes("ly do")) return "quan_he";
  return null;
}

export function infoField(label: string): keyof typeof INFO_ROWS | null {
  const l = plain(label);
  if (l.includes("ten bai")) return "ten_bai";
  if (l.includes("tinh huong")) return "tinh_huong";
  if (l.includes("nguong")) return "threshold";
  if (l.includes("lan truyen")) return "alpha";
  if (l.includes("so can cu")) return "topK";
  return null;
}
