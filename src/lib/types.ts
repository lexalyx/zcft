export interface LegalDoc {
  id: string;
  /** VN, KR, INT... */
  jurisdiction: string;
  text: string;
  /** Rủi ro gốc 0–1 do giảng viên đặt. */
  rui_ro: number;
}

export interface RiskLink {
  nguon: string;
  dich: string;
  quan_he: string;
}

export interface LessonSettings {
  /** Ngưỡng rủi ro để thành mắt xích. */
  threshold: number;
  /** Hệ số lan truyền rủi ro. */
  alpha: number;
  /** Số căn cứ liên quan đưa thêm cho AI. */
  topK: number;
}

export interface Lesson {
  ten_bai: string;
  tinh_huong: string;
  van_ban: LegalDoc[];
  lien_ket: RiskLink[];
  settings: LessonSettings;
}

export interface GradeResult {
  noi_dia: number;
  quoc_te: number;
  hoa_giai: number;
  /** Trung bình 3 lớp, do code tính. */
  trs: number;
  nhan_xet: string;
  goi_y: string;
}

export interface RiskReport {
  base: Map<string, number>;
  scores: Map<string, number>;
  sources: Map<string, { src: string; relation: string }[]>;
}

export interface NodeWork {
  challenge?: { text: string; contextIds: string[]; model: string };
  answer?: string;
  grade?: GradeResult;
  /** Bài làm tại thời điểm chấm, để biết bài đã sửa sau khi chấm. */
  gradedAnswer?: string;
}
