import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildResultsWorkbook, readLessonWorkbook } from "../src/lib/excel";
import { normalizeLesson } from "../src/lib/lesson";

async function workbookBuffer(build: (wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe("readLessonWorkbook", () => {
  it("đọc ba trang, chấp nhận tên trang/cột không dấu và cột đổi thứ tự", async () => {
    const buffer = await workbookBuffer((wb) => {
      const info = wb.addWorksheet("thong tin");
      info.addRow(["Tên bài", "Bài thử"]);
      info.addRow(["Tình huống", { richText: [{ text: "Công ty " }, { text: "A", font: { bold: true } }] }]);
      info.addRow(["Ngưỡng rủi ro", 0.6]);
      const docs = wb.addWorksheet("Van ban");
      docs.addRow(["Hướng dẫn: điền bên dưới"]);
      docs.addRow(["Noi dung tom tat", "Ma", "Rủi ro gốc"]);
      docs.addRow(["Văn bản A", "A", 0.7]);
      docs.addRow(["Văn bản B", "B", "70%"]);
      const links = wb.addWorksheet("Liên kết");
      links.addRow(["Từ văn bản", "Tới văn bản", "Quan hệ"]);
      links.addRow(["A", "B", "A kéo theo B"]);
    });
    const { lesson, warnings } = normalizeLesson(await readLessonWorkbook(buffer));
    expect(warnings).toEqual([]);
    expect(lesson.ten_bai).toBe("Bài thử");
    expect(lesson.tinh_huong).toBe("Công ty A");
    expect(lesson.settings.threshold).toBe(0.6);
    expect(lesson.van_ban.map((d) => [d.id, d.text, d.rui_ro])).toEqual([
      ["A", "Văn bản A", 0.7],
      ["B", "Văn bản B", 0.7],
    ]);
    expect(lesson.lien_ket).toEqual([{ nguon: "A", dich: "B", quan_he: "A kéo theo B" }]);
  });

  it("báo lỗi dễ hiểu khi thiếu trang Văn bản hoặc file hỏng", async () => {
    const noDocs = await workbookBuffer((wb) => wb.addWorksheet("Sheet1").addRow(["x"]));
    await expect(readLessonWorkbook(noDocs)).rejects.toThrow('trang "Văn bản"');
    await expect(readLessonWorkbook(new TextEncoder().encode("không phải zip").buffer)).rejects.toThrow(".xlsx");
  });
});

describe("buildResultsWorkbook", () => {
  it("ghi thông tin sinh viên và từng mắt xích", async () => {
    const blob = await buildResultsWorkbook({
      student: "Nguyễn Văn A",
      lesson: { ten_bai: "Bài thử", tinh_huong: "", van_ban: [], lien_ket: [], settings: { threshold: 0.5, alpha: 0.5, topK: 3 } },
      caseText: "Tình huống đã sửa",
      model: "gemini-2.5-flash",
      rows: [
        { rank: 1, docId: "A", risk: 0.756, challenge: "Hỏi", answer: "Đáp", grade: { noi_dia: 0.8, quoc_te: 0.5, hoa_giai: 0.6, trs: 0.6333, nhan_xet: "Tốt", goi_y: "" } },
        { rank: 2, docId: "B", risk: 0.6, challenge: "Hỏi 2", answer: "", grade: null },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const sheet = wb.getWorksheet("Kết quả");
    expect(sheet?.getCell("B1").value).toBe("Nguyễn Văn A");
    expect(sheet?.getRow(7).values).toEqual([undefined, 1, "A", 0.76, "Hỏi", "Đáp", 0.8, 0.5, 0.6, 0.63, "Tốt", ""]);
    expect(sheet?.getCell("B3").value).toBe("Tình huống đã sửa");
    expect(sheet?.getCell("B8").value).toBe("B");
  });
});
