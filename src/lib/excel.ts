import type { CellValue, Row as ExcelRow, Worksheet } from "exceljs";
import { docColumn, infoField, linkColumn, sheetKind } from "./excel-layout";
import { cleanStr, type RawLesson } from "./lesson";
import type { GradeResult, Lesson } from "./types";

type ExcelJSModule = typeof import("exceljs");

async function loadExcel(): Promise<ExcelJSModule> {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: ExcelJSModule }).default ?? mod;
}

type Cell = string | number;

export function cellValue(value: CellValue): Cell {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toLocaleDateString("vi-VN");
  if ("richText" in value) return value.richText.map((r) => r.text ?? "").join("");
  if ("result" in value) return cellValue((value.result ?? "") as CellValue);
  if ("text" in value) return cellValue(value.text as CellValue);
  return "";
}

function sheetRows(sheet: Worksheet): Cell[][] {
  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row: ExcelRow) => {
    const values: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellValue(cell.value);
    });
    rows.push(values);
  });
  return rows;
}

export function readTable(rows: Cell[][], columnOf: (header: string) => string | null): Record<string, Cell>[] {
  for (let r = 0; r < Math.min(rows.length, 10); r += 1) {
    const keys = Array.from(rows[r], (v) => columnOf(cleanStr(v)));
    if (keys.filter(Boolean).length < 2) continue;
    return rows.slice(r + 1).map((row) => {
      const item: Record<string, Cell> = {};
      keys.forEach((key, c) => {
        if (key && !(key in item)) item[key] = row[c] ?? "";
      });
      return item;
    });
  }
  return [];
}

export function readInfo(rows: Cell[][]): Pick<RawLesson, "ten_bai" | "tinh_huong" | "settings"> {
  const info: Pick<RawLesson, "ten_bai" | "tinh_huong"> = {};
  const settings: Record<string, Cell> = {};
  for (const row of rows) {
    const field = infoField(cleanStr(row[0]));
    const value = row[1] ?? "";
    if (field === "ten_bai" || field === "tinh_huong") info[field] = value;
    else if (field) settings[field] = value;
  }
  return { ...info, settings };
}

export async function readLessonWorkbook(buffer: ArrayBuffer): Promise<RawLesson> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error("Không mở được file. Hãy lưu file ở định dạng Excel (.xlsx) rồi thử lại.");
  }
  const sheets: Partial<Record<"info" | "docs" | "links", Worksheet>> = {};
  workbook.eachSheet((sheet) => {
    const kind = sheetKind(sheet.name);
    if (kind) sheets[kind] ??= sheet;
  });
  if (!sheets.docs) throw new Error('File không có trang "Văn bản". Hãy dùng file mẫu để tạo bài học.');
  return {
    ...(sheets.info ? readInfo(sheetRows(sheets.info)) : {}),
    van_ban: readTable(sheetRows(sheets.docs), docColumn),
    lien_ket: sheets.links ? readTable(sheetRows(sheets.links), linkColumn) : [],
  };
}

export interface ResultRow {
  rank: number;
  docId: string;
  risk: number;
  challenge: string;
  answer: string;
  grade: GradeResult | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

export async function buildResultsWorkbook(input: {
  student: string;
  lesson: Lesson;
  caseText: string;
  model: string;
  rows: ResultRow[];
}): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZCFT";
  const sheet = workbook.addWorksheet("Kết quả", { views: [{ state: "frozen", ySplit: 6 }] });

  sheet.addRow(["Sinh viên", input.student]);
  sheet.addRow(["Bài học", input.lesson.ten_bai]);
  sheet.addRow(["Tình huống", input.caseText]);
  sheet.addRow(["Thời điểm xuất", new Date().toLocaleString("vi-VN")]);
  sheet.addRow(["Model chấm", input.model]);
  for (let r = 1; r <= 5; r += 1) sheet.getRow(r).getCell(1).font = { bold: true };

  const header = sheet.addRow([
    "Thứ tự", "Mắt xích", "Rủi ro", "Câu hỏi của đối phương", "Bài làm",
    "Nội địa", "Quốc tế", "Hòa giải", "TRS", "Nhận xét", "Gợi ý",
  ]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C2B4A" } };

  for (const row of input.rows) {
    const g = row.grade;
    sheet.addRow([
      row.rank, row.docId, round(row.risk), row.challenge, row.answer,
      g ? round(g.noi_dia) : "", g ? round(g.quoc_te) : "", g ? round(g.hoa_giai) : "",
      g ? round(g.trs) : "", g?.nhan_xet ?? "", g?.goi_y ?? "",
    ]);
  }

  [8, 22, 8, 50, 70, 9, 9, 9, 8, 45, 45].forEach((width, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = width;
    column.alignment = { wrapText: true, vertical: "top" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
