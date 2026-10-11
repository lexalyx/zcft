import { afterEach, describe, expect, it, vi } from "vitest";
import { generate, GeminiError, listTextModels, parseChallenges, parseGrade, UnsupportedModelError } from "../src/lib/gemini";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("listTextModels", () => {
  it("chỉ giữ model sinh văn bản, Gemini lên trước, gửi key qua header", async () => {
    const fetchMock = mockFetch(200, {
      models: [
        { name: "models/gemma-3-27b-it", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
        { name: "models/deep-research-pro-preview-12-2025", supportedGenerationMethods: ["generateContent"] },
        { name: "models/antigravity-preview", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
      ],
    });
    expect(await listTextModels("KEY")).toEqual(["gemini-2.5-flash", "gemini-2.5-pro", "gemma-3-27b-it"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("KEY");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
  });

  it("dịch lỗi key sai sang tiếng Việt", async () => {
    mockFetch(400, { error: { message: "API key not valid. Please pass a valid API key." } });
    await expect(listTextModels("bad")).rejects.toThrow("API key không hợp lệ");
  });

  it("báo hết lượt khi bị giới hạn", async () => {
    mockFetch(429, { error: { message: "Resource exhausted" } });
    await expect(listTextModels("k")).rejects.toThrow("hết lượt");
  });
});

describe("generate", () => {
  it("ghép các phần văn bản, bỏ phần suy nghĩ, bật JSON khi cần", async () => {
    const fetchMock = mockFetch(200, {
      candidates: [{ content: { parts: [{ text: "nghĩ...", thought: true }, { text: "Câu " }, { text: "hỏi" }] } }],
    });
    expect(await generate("k", "gemini-2.5-flash", "p", { json: true })).toBe("Câu hỏi");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("dừng ngay khi bị huỷ, không chờ Gemini", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const controller = new AbortController();
    const pending = generate("k", "m", "p", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow("Đã huỷ");
  });

  it("nhận ra model chỉ chạy qua Interactions API", async () => {
    mockFetch(400, { error: { message: "This model only supports Interactions API." } });
    await expect(generate("k", "m", "p")).rejects.toBeInstanceOf(UnsupportedModelError);
  });

  it("báo lỗi khi bị chặn", async () => {
    mockFetch(200, { promptFeedback: { blockReason: "SAFETY" } });
    await expect(generate("k", "m", "p")).rejects.toBeInstanceOf(GeminiError);
  });
});

describe("parseChallenges", () => {
  it("đọc câu hỏi theo mã, bỏ phần tử thiếu nội dung", () => {
    const questions = parseChallenges('```json\n{"cau_hoi": [{"id": "[A]", "noi_dung": " Hỏi A "}, {"id": "B", "noi_dung": ""}, {"id": "C", "noi_dung": "Hỏi C"}]}\n```');
    expect([...questions]).toEqual([["A", "Hỏi A"], ["C", "Hỏi C"]]);
  });

  it("ném lỗi khi không có danh sách", () => {
    expect(() => parseChallenges('{"x": 1}')).toThrow();
  });
});

describe("parseGrade", () => {
  it("tính TRS bằng code và giới hạn điểm trong 0–1", () => {
    const g = parseGrade('```json\n{"noi_dia": 0.9, "quoc_te": 1.4, "hoa_giai": "0,3", "nhan_xet": "Tốt", "goi_y_chien_luoc": "Thêm"}\n```');
    expect(g.quoc_te).toBeCloseTo(0.014);
    expect(g.hoa_giai).toBeCloseTo(0.3);
    expect(g.trs).toBeCloseTo((0.9 + 0.014 + 0.3) / 3);
    expect(g.goi_y).toBe("Thêm");
  });

  it("ném lỗi khi không phải JSON", () => {
    expect(() => parseGrade("không phải json")).toThrow();
  });
});
