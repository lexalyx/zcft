import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { DEFAULT_SETTINGS } from "../src/lib/config";
import { DOC_HEADERS, GUIDE, INFO_ROWS, LINK_HEADERS, SHEETS } from "../src/lib/excel-layout";
import type { LegalDoc, LessonSettings, RiskLink } from "../src/lib/types";

interface LessonInput {
  ten_bai: string;
  tinh_huong: string;
  van_ban: LegalDoc[];
  lien_ket: RiskLink[];
  settings?: Partial<LessonSettings>;
}

const EXAMPLE: LessonInput = {
  ten_bai: "Tên bài học",
  tinh_huong: "Mô tả vụ việc mà sinh viên sẽ đọc. Có thể viết nhiều đoạn (Alt+Enter để xuống dòng trong ô).",
  van_ban: [
    { id: "VN_BLLD_107", jurisdiction: "VN", rui_ro: 0.7, text: "Điều 107 Bộ luật Lao động 2019: tóm tắt nội dung điều luật cần dùng trong bài." },
    { id: "VN_BLLD_98", jurisdiction: "VN", rui_ro: 0.6, text: "Điều 98 Bộ luật Lao động 2019: tóm tắt nội dung điều luật." },
  ],
  lien_ket: [{ nguon: "VN_BLLD_107", dich: "VN_BLLD_98", quan_he: "Vi phạm ở văn bản nguồn kéo theo rủi ro ở văn bản đích như thế nào" }],
};

const MAX_ROWS = 300;
const INK = "FF1C2B4A";
const WRAP_TOP: Partial<ExcelJS.Alignment> = { wrapText: true, vertical: "top" };

/** ExcelJS có dataValidations.add theo vùng nhưng chưa khai báo kiểu. */
function addValidation(sheet: ExcelJS.Worksheet, range: string, validation: ExcelJS.DataValidation): void {
  (sheet as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations.add(range, validation);
}

function header(sheet: ExcelJS.Worksheet, titles: readonly string[], widths: number[]): void {
  const row = sheet.addRow([...titles]);
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  widths.forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function wrapBody(sheet: ExcelJS.Worksheet, columns: number): void {
  for (let r = 2; r <= MAX_ROWS; r += 1) {
    for (let c = 1; c <= columns; c += 1) sheet.getCell(r, c).alignment = WRAP_TOP;
  }
}

export function buildWorkbook(lesson: LessonInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZCFT";
  const settings = { ...DEFAULT_SETTINGS, ...lesson.settings };

  const info = wb.addWorksheet(SHEETS.info);
  info.columns = [{ width: 22 }, { width: 90 }, { width: 30 }];
  info.addRows([
    [INFO_ROWS.ten_bai, lesson.ten_bai],
    [INFO_ROWS.tinh_huong, lesson.tinh_huong],
    [],
    [INFO_ROWS.threshold, settings.threshold, "Từ 0 đến 1. Mặc định 0,5."],
    [INFO_ROWS.alpha, settings.alpha, "Từ 0 đến 1. Mặc định 0,5."],
    [INFO_ROWS.topK, settings.topK, "Từ 1 đến 10. Mặc định 3."],
  ]);
  info.getRow(2).height = 160;
  info.eachRow((row) => {
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    row.getCell(1).alignment = WRAP_TOP;
    row.getCell(2).alignment = WRAP_TOP;
    row.getCell(3).font = { italic: true, color: { argb: "FF566176" } };
  });
  const unit = (title: string): ExcelJS.DataValidation => ({
    type: "decimal", operator: "between", formulae: [0, 1], allowBlank: true,
    showErrorMessage: true, errorTitle: title, error: "Nhập số từ 0 đến 1, ví dụ 0,5.",
  });
  addValidation(info, "B4:B5", unit("Giá trị không hợp lệ"));
  addValidation(info, "B6", {
    type: "whole", operator: "between", formulae: [1, 10], allowBlank: true,
    showErrorMessage: true, errorTitle: "Giá trị không hợp lệ", error: "Nhập số nguyên từ 1 đến 10.",
  });

  const docs = wb.addWorksheet(SHEETS.docs);
  header(docs, DOC_HEADERS, [20, 10, 90, 14]);
  for (const d of lesson.van_ban) docs.addRow([d.id, d.jurisdiction, d.text, d.rui_ro]);
  wrapBody(docs, 4);
  addValidation(docs, `D2:D${MAX_ROWS}`, {
    ...unit("Rủi ro gốc không hợp lệ"),
    showInputMessage: true, promptTitle: "Rủi ro gốc", prompt: "Từ 0 (không rủi ro) đến 1 (chắc chắn vi phạm).",
  });

  const links = wb.addWorksheet(SHEETS.links);
  header(links, LINK_HEADERS, [22, 22, 80]);
  for (const l of lesson.lien_ket) links.addRow([l.nguon, l.dich, l.quan_he]);
  wrapBody(links, 3);
  addValidation(links, `A2:B${MAX_ROWS}`, {
    type: "list", formulae: [`'${SHEETS.docs}'!$A$2:$A$${MAX_ROWS}`], allowBlank: true,
    showErrorMessage: true, errorTitle: "Mã không có trong trang Văn bản", error: "Chọn một mã đã khai báo ở trang Văn bản.",
  });

  const guide = wb.addWorksheet(SHEETS.guide);
  guide.columns = [{ width: 24 }, { width: 100 }];
  guide.addRows(GUIDE);
  guide.eachRow((row) => {
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    row.eachCell((cell) => (cell.alignment = WRAP_TOP));
  });

  return wb;
}

async function main(): Promise<void> {
  const [out, jsonPath] = process.argv.slice(2);
  if (!out) {
    console.error("Cách dùng: npx tsx scripts/make-template.ts <ra.xlsx> [bài.json]");
    process.exit(1);
  }
  const lesson: LessonInput = jsonPath ? JSON.parse(readFileSync(jsonPath, "utf-8").replace(/^﻿/, "")) : EXAMPLE;
  await buildWorkbook(lesson).xlsx.writeFile(out);
  console.log(`Đã tạo ${out}`);
}

await main();
