export interface EmbedModel {
  id: string;
  downloadMb: number;
  /** Họ e5 được huấn luyện với tiền tố này ở câu hỏi và ở văn bản; thiếu thì điểm tương đồng kém. */
  queryPrefix: string;
  passagePrefix: string;
}

/** Kích thước là bản q8 trên Hugging Face. */
export const EMBED_MODELS: EmbedModel[] = [
  { id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2", downloadMb: 118, queryPrefix: "", passagePrefix: "" },
  { id: "Xenova/multilingual-e5-small", downloadMb: 118, queryPrefix: "query: ", passagePrefix: "passage: " },
  { id: "Xenova/multilingual-e5-base", downloadMb: 279, queryPrefix: "query: ", passagePrefix: "passage: " },
];
export const EMBED_DTYPE = "q8";
/**
 * transformers.js tải từ CDN lúc chạy (khoá đúng phiên bản), không cài qua npm,
 * vì bản npm kéo theo onnxruntime-node hơn 500 MB chỉ dùng cho Node.
 */
export const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
export const GEMINI_TIMEOUT_MS = 60_000;
export const API_KEY_URL = "https://aistudio.google.com/apikey";

export const DEFAULT_SETTINGS = { threshold: 0.5, alpha: 0.5, topK: 3 } as const;
export const DEFAULT_BASE_RISK = 0.5;
export const MIN_ANSWER_CHARS = 20;

/** Đường dẫn tương đối so với trang (chạy được ở mọi địa chỉ GitHub Pages). */
export const LESSON_INDEX_URL = "lessons/index.json";
export const LESSONS_DIR_URL = "lessons/";
export const TEMPLATE_URL = "mau_bai_hoc.xlsx";
