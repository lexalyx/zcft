/** Noisy-OR: rủi ro cuối = 1 - (1 - rủi ro gốc) × Π(1 - alpha × rủi ro của văn bản nguồn). */
import type { LegalDoc, RiskLink, RiskReport } from "./types";

export function propagateRisk(
  docs: LegalDoc[],
  links: RiskLink[],
  alpha: number,
  maxIters = 50,
  tol = 1e-6,
): RiskReport {
  const base = new Map(docs.map((d) => [d.id, d.rui_ro]));
  const sources = new Map<string, { src: string; relation: string }[]>(docs.map((d) => [d.id, []]));
  for (const link of links) {
    if (base.has(link.nguon) && base.has(link.dich) && link.nguon !== link.dich) {
      sources.get(link.dich)?.push({ src: link.nguon, relation: link.quan_he });
    }
  }

  let scores = new Map(base);
  for (let iter = 0; iter < maxIters; iter += 1) {
    const next = new Map<string, number>();
    let delta = 0;
    for (const [node, baseRisk] of base) {
      let keep = 1 - baseRisk;
      for (const { src } of sources.get(node) ?? []) keep *= 1 - alpha * (scores.get(src) ?? 0);
      const value = 1 - keep;
      next.set(node, value);
      delta = Math.max(delta, Math.abs(value - (scores.get(node) ?? 0)));
    }
    scores = next;
    if (delta < tol) break;
  }
  return { base, scores, sources };
}

export function riskyNodes(report: RiskReport, threshold: number): string[] {
  return [...report.scores.entries()]
    .filter(([, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([node]) => node);
}
