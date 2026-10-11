import { LESSON_INDEX_URL, LESSONS_DIR_URL } from "./config";
import { readLessonWorkbook } from "./excel";
import { normalizeLesson } from "./lesson";
import type { Lesson } from "./types";

export interface LessonEntry {
  file: string;
  title: string;
}

export interface LoadedLesson {
  lesson: Lesson;
  warnings: string[];
}

export async function fetchLessonIndex(): Promise<LessonEntry[]> {
  try {
    const response = await fetch(LESSON_INDEX_URL, { cache: "no-cache" });
    if (!response.ok) return [];
    const data = (await response.json()) as { lessons?: Partial<LessonEntry>[] };
    return (data.lessons ?? [])
      .filter((item): item is LessonEntry => typeof item?.file === "string")
      .map((item) => ({ file: item.file, title: item.title || item.file.replace(/\.xlsx$/i, "") }));
  } catch {
    return [];
  }
}

export async function loadSiteLesson(file: string): Promise<LoadedLesson> {
  const response = await fetch(LESSONS_DIR_URL + encodeURIComponent(file), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Không tải được file ${file} (lỗi ${response.status}).`);
  return normalizeLesson(await readLessonWorkbook(await response.arrayBuffer()));
}

export async function loadLocalLesson(file: File): Promise<LoadedLesson> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Chỉ mở được file Excel (.xlsx).");
  return normalizeLesson(await readLessonWorkbook(await file.arrayBuffer()));
}
