import { EMBED_DTYPE, TRANSFORMERS_URL, type EmbedModel } from "./config";
import type { LegalDoc } from "./types";

export interface Progress {
  loaded: number;
  total: number;
}

export interface Retrieval {
  results: { doc: LegalDoc; score: number }[];
  method: "semantic" | "tfidf";
  /** Lý do không dùng được mô hình (nếu có), khi đó đã chuyển sang TF-IDF. */
  error: string;
}

// Tương đương char_wb 2–4 của scikit-learn.
function charGrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const padded = ` ${word} `;
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i + n <= padded.length; i += 1) {
        const gram = padded.slice(i, i + n);
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function l2normalize(vec: Map<string, number>): Map<string, number> {
  let norm = 0;
  for (const v of vec.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of vec) vec.set(k, v / norm);
  return vec;
}

export function tfidfScores(query: string, texts: string[]): number[] {
  const docGrams = texts.map(charGrams);
  const df = new Map<string, number>();
  for (const grams of docGrams) for (const g of grams.keys()) df.set(g, (df.get(g) ?? 0) + 1);
  const n = texts.length;
  const weigh = (grams: Map<string, number>) => {
    const vec = new Map<string, number>();
    for (const [g, tf] of grams) {
      const d = df.get(g);
      if (d !== undefined) vec.set(g, tf * (Math.log((1 + n) / (1 + d)) + 1));
    }
    return l2normalize(vec);
  };
  const queryVec = weigh(charGrams(query));
  return docGrams.map((grams) => {
    const vec = weigh(grams);
    let dot = 0;
    for (const [g, w] of queryVec) dot += w * (vec.get(g) ?? 0);
    return dot;
  });
}

type Extractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

interface TransformersModule {
  env: { allowLocalModels: boolean };
  pipeline(
    task: "feature-extraction",
    model: string,
    options: { dtype: string; progress_callback: (event: unknown) => void },
  ): Promise<Extractor>;
}

/** Cho phép test thay bằng module giả. */
export let importTransformers = (): Promise<TransformersModule> =>
  import(/* @vite-ignore */ TRANSFORMERS_URL) as Promise<TransformersModule>;

export function setTransformersLoader(loader: () => Promise<TransformersModule>): void {
  importTransformers = loader;
  extractors.clear();
  embeddingCache.clear();
}

const extractors = new Map<string, Promise<Extractor>>();
const embeddingCache = new Map<string, number[]>();
const progressListeners = new Set<(progress: Progress) => void>();
const fileProgress = new Map<string, Progress>();

export function onModelProgress(handler: (progress: Progress) => void): () => void {
  progressListeners.add(handler);
  return () => progressListeners.delete(handler);
}

function reportProgress(event: unknown): void {
  const e = event as { status?: string; file?: string; loaded?: number; total?: number };
  if (e?.status !== "progress" || !e.file) return;
  fileProgress.set(e.file, { loaded: e.loaded ?? 0, total: e.total ?? 0 });
  let loaded = 0;
  let total = 0;
  for (const p of fileProgress.values()) {
    loaded += p.loaded;
    total += p.total;
  }
  for (const handler of progressListeners) handler({ loaded, total });
}

export function loadEmbedder(model: string): Promise<Extractor> {
  let promise = extractors.get(model);
  if (!promise) {
    promise = (async () => {
      const { pipeline, env } = await importTransformers();
      env.allowLocalModels = false;
      fileProgress.clear();
      return pipeline("feature-extraction", model, { dtype: EMBED_DTYPE, progress_callback: reportProgress });
    })();
    extractors.set(model, promise);
    promise.catch(() => extractors.delete(model));
  }
  return promise;
}

async function embed(model: string, texts: string[]): Promise<number[][]> {
  const key = (text: string) => `${model}\u0000${text}`;
  const missing = [...new Set(texts.filter((t) => !embeddingCache.has(key(t))))];
  if (missing.length) {
    const extractor = await loadEmbedder(model);
    const vectors = (await extractor(missing, { pooling: "mean", normalize: true })).tolist();
    missing.forEach((text, i) => embeddingCache.set(key(text), vectors[i]));
  }
  return texts.map((t) => embeddingCache.get(key(t)) as number[]);
}

async function semanticScores(model: EmbedModel, query: string, texts: string[]): Promise<number[]> {
  const [queryVec, ...docVecs] = await embed(model.id, [model.queryPrefix + query, ...texts.map((t) => model.passagePrefix + t)]);
  return docVecs.map((vec) => vec.reduce((sum, v, i) => sum + v * queryVec[i], 0));
}

export async function retrieve(
  query: string,
  docs: LegalDoc[],
  topK: number,
  model: EmbedModel | undefined,
): Promise<Retrieval> {
  if (!docs.length || topK <= 0) return { results: [], method: "tfidf", error: "" };
  const texts = docs.map((d) => d.text);
  let scores: number[];
  let method: Retrieval["method"] = "tfidf";
  let error = "";
  if (model) {
    try {
      scores = await semanticScores(model, query, texts);
      method = "semantic";
    } catch (exc) {
      error = exc instanceof Error ? exc.message : String(exc);
      scores = tfidfScores(query, texts);
    }
  } else {
    scores = tfidfScores(query, texts);
  }
  const results = docs
    .map((doc, i) => ({ doc, score: scores[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return { results, method, error };
}
