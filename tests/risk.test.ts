import { describe, expect, it } from "vitest";
import { propagateRisk, riskyNodes } from "../src/lib/risk";
import type { LegalDoc } from "../src/lib/types";

const doc = (id: string, rui_ro: number): LegalDoc => ({ id, jurisdiction: "", text: id, rui_ro });

describe("propagateRisk", () => {
  it("alpha = 0 chỉ giữ rủi ro gốc", () => {
    const report = propagateRisk([doc("A", 0.7), doc("B", 0.2)], [{ nguon: "A", dich: "B", quan_he: "" }], 0);
    expect(report.scores.get("B")).toBeCloseTo(0.2);
  });

  it("noisy-OR: 1 - (1 - gốc) × (1 - alpha × nguồn)", () => {
    const report = propagateRisk([doc("A", 0.6), doc("B", 0.5)], [{ nguon: "A", dich: "B", quan_he: "x" }], 0.5);
    expect(report.scores.get("A")).toBeCloseTo(0.6);
    expect(report.scores.get("B")).toBeCloseTo(1 - 0.5 * (1 - 0.5 * 0.6));
    expect(report.sources.get("B")).toEqual([{ src: "A", relation: "x" }]);
  });

  it("hội tụ cả khi có vòng", () => {
    const report = propagateRisk(
      [doc("A", 0.3), doc("B", 0.3)],
      [
        { nguon: "A", dich: "B", quan_he: "" },
        { nguon: "B", dich: "A", quan_he: "" },
      ],
      0.5,
    );
    const a = report.scores.get("A") ?? 0;
    expect(a).toBeGreaterThan(0.3);
    expect(a).toBeLessThan(1);
    expect(report.scores.get("B")).toBeCloseTo(a);
  });

  it("riskyNodes lọc theo ngưỡng và xếp giảm dần", () => {
    const report = propagateRisk([doc("A", 0.4), doc("B", 0.9), doc("C", 0.6)], [], 0.5);
    expect(riskyNodes(report, 0.5)).toEqual(["B", "C"]);
  });
});
