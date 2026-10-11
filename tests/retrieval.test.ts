import { beforeEach, describe, expect, it } from "vitest";
import { onModelProgress, retrieve, setTransformersLoader, tfidfScores } from "../src/lib/retrieval";
import type { LegalDoc } from "../src/lib/types";

const docs: LegalDoc[] = [
  { id: "OT", jurisdiction: "VN", text: "Làm thêm giờ không quá 40 giờ trong một tháng", rui_ro: 0.5 },
  { id: "SA", jurisdiction: "KR", text: "Không được sa thải nếu không có lý do chính đáng", rui_ro: 0.5 },
  { id: "DL", jurisdiction: "VN", text: "Bảo vệ dữ liệu cá nhân của người lao động", rui_ro: 0.5 },
];

describe("tfidfScores", () => {
  it("văn bản trùng từ ngữ với câu hỏi được điểm cao nhất", () => {
    const scores = tfidfScores("công nhân làm thêm giờ quá nhiều", docs.map((d) => d.text));
    expect(scores.indexOf(Math.max(...scores))).toBe(0);
  });
});

const model = { id: "giả", downloadMb: 1, queryPrefix: "query: ", passagePrefix: "" };

describe("retrieve", () => {
  beforeEach(() => {
    setTransformersLoader(async () => ({
      env: { allowLocalModels: true },
      async pipeline(_task, _model, options) {
        options.progress_callback({ status: "progress", file: "model.onnx", loaded: 50, total: 100 });
        return async (texts) => ({
          tolist: () =>
            texts.map((t) => {
              const v = [/sa thải/.test(t) ? 1 : 0, /giờ/.test(t) ? 1 : 0, /dữ liệu/.test(t) ? 1 : 0];
              const n = Math.hypot(...v) || 1;
              return v.map((x) => x / n);
            }),
        });
      },
    }));
  });

  it("dùng mô hình theo nghĩa và báo tiến độ tải", async () => {
    const seen: number[] = [];
    const stop = onModelProgress(({ loaded }) => seen.push(loaded));
    const { results, method, error } = await retrieve("bị sa thải vì thuật toán", docs, 2, model);
    stop();
    expect(method).toBe("semantic");
    expect(error).toBe("");
    expect(results[0].doc.id).toBe("SA");
    expect(results).toHaveLength(2);
    expect(seen).toContain(50);
  });

  it("thêm tiền tố của mô hình vào câu hỏi và văn bản", async () => {
    const seen: string[] = [];
    setTransformersLoader(async () => ({
      env: { allowLocalModels: true },
      pipeline: async () => async (texts) => {
        seen.push(...texts);
        return { tolist: () => texts.map(() => [1]) };
      },
    }));
    await retrieve("câu hỏi", docs.slice(0, 1), 1, { ...model, passagePrefix: "passage: " });
    expect(seen).toEqual(["query: câu hỏi", `passage: ${docs[0].text}`]);
  });

  it("chuyển sang TF-IDF và báo lỗi khi không tải được mô hình", async () => {
    setTransformersLoader(async () => {
      throw new Error("mất mạng");
    });
    const { method, error, results } = await retrieve("làm thêm giờ", docs, 1, model);
    expect(method).toBe("tfidf");
    expect(error).toBe("mất mạng");
    expect(results[0].doc.id).toBe("OT");
  });

  it("không tải mô hình khi tắt tìm theo nghĩa", async () => {
    let loaded = false;
    setTransformersLoader(async () => {
      loaded = true;
      throw new Error("không được gọi");
    });
    const { method } = await retrieve("dữ liệu", docs, 1, undefined);
    expect(method).toBe("tfidf");
    expect(loaded).toBe(false);
  });
});
