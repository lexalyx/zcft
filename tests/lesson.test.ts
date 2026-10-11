import { describe, expect, it } from "vitest";
import { docError, fingerprint, normalizeLesson, plain, toUnit } from "../src/lib/lesson";

describe("toUnit", () => {
  it.each([
    [0.7, 0.7],
    ["0,7", 0.7],
    ["70%", 0.7],
    [70, 0.7],
    [1.5, 0.015],
    [-1, 0],
    [250, 1],
  ])("đọc %s thành %s", (input, expected) => {
    expect(toUnit(input)).toBeCloseTo(expected);
  });

  it("dùng giá trị mặc định khi trống hoặc không phải số", () => {
    expect(toUnit("", 0.5)).toBe(0.5);
    expect(toUnit("abc", 0.3)).toBe(0.3);
    expect(toUnit(undefined, 0.2)).toBe(0.2);
  });
});

describe("docError", () => {
  it("bắt thiếu nội dung, mã có dấu và mã trùng", () => {
    expect(docError("A_1", "Nội dung", ["B"])).toBe("");
    expect(docError("A_1", " ", [])).toContain("Nhập mã");
    expect(docError("Điều 1", "Nội dung", [])).toContain("viết liền");
    expect(docError(" B ", "Nội dung", ["B"])).toContain("bị trùng");
  });
});

describe("plain", () => {
  it("bỏ dấu, đ và ký tự đặc biệt", () => {
    expect(plain("Tình huống")).toBe("tinh huong");
    expect(plain("  Đường  dẫn / (0–1) ")).toBe("duong dan 0 1");
  });
});

describe("normalizeLesson", () => {
  it("bỏ dòng thiếu, mã trùng và liên kết tới mã không tồn tại, kèm cảnh báo", () => {
    const { lesson, warnings } = normalizeLesson({
      ten_bai: " Bài 1 ",
      van_ban: [
        { id: "A", text: "Văn bản A", rui_ro: "0,8" },
        { id: "A", text: "Trùng" },
        { id: "", text: "Thiếu mã" },
        { id: "B", text: "Văn bản B", rui_ro: "" },
        {},
      ],
      lien_ket: [
        { nguon: "A", dich: "B", quan_he: "A kéo theo B" },
        { nguon: "A", dich: "C" },
        { nguon: "A", dich: "A" },
        { nguon: "A", dich: "B" },
      ],
      settings: { threshold: "60%", topK: "20" },
    });
    expect(lesson.ten_bai).toBe("Bài 1");
    expect(lesson.van_ban.map((d) => [d.id, d.rui_ro])).toEqual([
      ["A", 0.8],
      ["B", 0.5],
    ]);
    expect(lesson.lien_ket).toEqual([{ nguon: "A", dich: "B", quan_he: "A kéo theo B" }]);
    expect(lesson.settings).toEqual({ threshold: 0.6, alpha: 0.5, topK: 10 });
    expect(warnings).toHaveLength(3);
    expect(warnings.join("\n")).toContain("mã A bị trùng");
    expect(warnings.join("\n")).toContain("mã C");
  });

  it("cảnh báo khi không có văn bản nào", () => {
    const { lesson, warnings } = normalizeLesson({});
    expect(lesson.ten_bai).toBe("Bài học chưa đặt tên");
    expect(warnings[0]).toContain("chưa có văn bản");
  });
});

describe("fingerprint", () => {
  it("ổn định và phân biệt nội dung", () => {
    expect(fingerprint("a", [1, 2])).toBe(fingerprint("a", [1, 2]));
    expect(fingerprint("a")).not.toBe(fingerprint("b"));
  });
});
