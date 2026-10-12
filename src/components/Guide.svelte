<script lang="ts">
  import html from "virtual:guide";
</script>

<article class="guide">{@html html}</article>

<style>
  .guide { max-width: 78ch; padding-top: 2.25rem; }
  .guide :global(h1) { font-family: var(--serif); font-size: var(--step-4); }
  .guide :global(h2) { font-size: var(--step-2); margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); }
  .guide :global(h3) { font-size: var(--step-1); margin-top: 1.75rem; }
  .guide :global(img) { display: block; max-width: 100%; height: auto; margin: 1.25rem 0; border: 1px solid var(--rule); border-radius: var(--radius); }
  .guide :global(li) { margin: 0.3rem 0; }
  .guide :global(table) { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: var(--step--1); background: var(--sheet); }
  .guide :global(th), .guide :global(td) { border: 1px solid var(--rule); padding: 0.5rem 0.7rem; text-align: left; vertical-align: top; }
  .guide :global(blockquote) { margin: 1.25rem 0; padding: 0.85rem 1rem; background: var(--pen-soft); border-radius: var(--radius); }
  .guide :global(blockquote p) { margin: 0; }
  .guide :global(code) { background: var(--sheet); overflow-wrap: anywhere; }
</style>
