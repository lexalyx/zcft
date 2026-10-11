<script lang="ts">
  let { score, base }: { score: number; base?: number } = $props();

  const fmt = (value: number) => value.toFixed(2);
  let shifted = $derived(base !== undefined && Math.abs(base - score) > 0.005);
  let label = $derived(shifted && base !== undefined ? `Rủi ro ${fmt(score)} (gốc ${fmt(base)})` : `Rủi ro ${fmt(score)}`);
</script>

<span class="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={score} aria-label={label} title={shifted ? label : undefined}>
  <span class="word" aria-hidden="true">rủi ro</span>
  <span class="track" aria-hidden="true">
    <span class="fill" style:width="{Math.round(score * 100)}%"></span>
    {#if shifted && base !== undefined}
      <span class="base" style:left="{Math.round(base * 100)}%"></span>
    {/if}
  </span>
  <span aria-hidden="true">{fmt(score)}</span>
</span>

<style>
  .meter {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: var(--step--1);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .word { color: var(--muted); }
  .track {
    position: relative;
    width: 4.5rem;
    height: 6px;
    background: var(--bg);
    border-radius: 3px;
    overflow: hidden;
  }
  .fill { position: absolute; inset: 0 auto 0 0; background: var(--ink); border-radius: 3px; }
  .base { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--muted); }
</style>
