<script lang="ts">
  import type { GradeResult } from "../lib/types";

  let { grade, stale }: { grade: GradeResult; stale: boolean } = $props();

  const fmt = (value: number) => value.toFixed(2);
  let layers = $derived([
    { name: "Nội địa", value: grade.noi_dia },
    { name: "Quốc tế", value: grade.quoc_te },
    { name: "Hòa giải", value: grade.hoa_giai },
  ]);
</script>

<section class="grade" aria-label="Đánh giá">
  <div class="score"><strong>{fmt(grade.trs)}</strong><span>Telic Resonance Score, trung bình 3 lớp</span></div>
  <ul class="layers">
    {#each layers as layer (layer.name)}
      <li>
        <span>{layer.name}</span>
        <span class="track" aria-hidden="true"><span class="fill" style:width="{Math.round(layer.value * 100)}%"></span></span>
        <span class="value">{fmt(layer.value)}</span>
      </li>
    {/each}
  </ul>
  {#if grade.nhan_xet}<p class="text"><strong>Nhận xét:</strong> {grade.nhan_xet}</p>{/if}
  {#if grade.goi_y}<p class="text"><strong>Gợi ý:</strong> {grade.goi_y}</p>{/if}
  {#if stale}<p class="status">Bạn đã sửa bài sau lần chấm này. Nộp lại để được chấm bản mới.</p>{/if}
</section>

<style>
  .grade { margin-top: 1.1rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
  .score { display: flex; align-items: baseline; gap: 0.6rem; }
  .score strong { font-size: var(--step-3); font-variant-numeric: tabular-nums; }
  .score span { color: var(--muted); font-size: var(--step--1); }
  .layers { list-style: none; padding: 0; margin: 0.8rem 0 0; display: grid; gap: 0.45rem; max-width: 26rem; }
  .layers li { display: grid; grid-template-columns: 6rem 1fr 2.5rem; align-items: center; gap: 0.6rem; font-size: var(--step--1); }
  .track { display: block; height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--pen); border-radius: 4px; }
  .value { text-align: right; font-variant-numeric: tabular-nums; }
  .text { margin: 0.9rem 0 0; max-width: 70ch; }
  .text strong { font-weight: 600; }
</style>
