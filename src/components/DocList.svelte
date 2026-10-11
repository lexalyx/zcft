<script lang="ts">
  import { docError, toUnit } from "../lib/lesson";
  import { session } from "../lib/state.svelte";
  import Meter from "./Meter.svelte";

  let nodeIds = $derived(new Set(session.nodes));
  let docs = $derived.by(() => {
    const report = session.report;
    if (!session.lesson || !report) return [];
    return [...session.lesson.van_ban].sort((a, b) => (report.scores.get(b.id) ?? 0) - (report.scores.get(a.id) ?? 0));
  });

  let extraIds = $derived(new Set(session.extraDocs.map((d) => d.id)));
  let draft = $state({ id: "", jurisdiction: "", rui_ro: "", text: "" });
  let error = $state("");

  function addDoc(event: SubmitEvent) {
    event.preventDefault();
    error = docError(draft.id, draft.text, (session.lesson?.van_ban ?? []).map((d) => d.id));
    if (error) return;
    session.addDoc({ id: draft.id.trim(), jurisdiction: draft.jurisdiction.trim(), text: draft.text.trim(), rui_ro: toUnit(draft.rui_ro) });
    draft = { id: "", jurisdiction: "", rui_ro: "", text: "" };
  }
</script>

<aside class="dossier" aria-labelledby="dossier-title">
  <h2 id="dossier-title">Căn cứ pháp lý của bài</h2>
  <ol class="docs">
    {#each docs as doc (doc.id)}
      {@const sources = session.report?.sources.get(doc.id) ?? []}
      <li class="doc" class:is-node={nodeIds.has(doc.id)}>
        <div class="head">
          <span class="id">{doc.id}{#if doc.jurisdiction}<span class="scope">{doc.jurisdiction}</span>{/if}</span>
          <Meter score={session.report?.scores.get(doc.id) ?? 0} base={session.report?.base.get(doc.id)} />
        </div>
        <p class="text">{doc.text}</p>
        {#if sources.length}
          <p class="sources">
            Nhận rủi ro từ {sources.map((s) => (s.relation ? `${s.src} (${s.relation})` : s.src)).join("; ")}
          </p>
        {/if}
        {#if extraIds.has(doc.id)}
          <button type="button" class="btn-link" onclick={() => session.removeDoc(doc.id)}>Xoá văn bản này</button>
        {/if}
      </li>
    {/each}
  </ol>

  <details class="notes">
    <summary>Thêm văn bản vào bài này</summary>
    <form onsubmit={addDoc}>
      <div class="row">
        <label>Mã <input type="text" spellcheck="false" bind:value={draft.id} /></label>
        <label>Phạm vi <input type="text" spellcheck="false" bind:value={draft.jurisdiction} /></label>
        <label>Rủi ro gốc (0–1) <input type="text" inputmode="decimal" bind:value={draft.rui_ro} /></label>
      </div>
      <label>Nội dung tóm tắt <textarea rows="3" bind:value={draft.text}></textarea></label>
      <button type="submit" class="btn btn-quiet">Thêm văn bản</button>
      {#if error}<p class="status is-error" role="alert">{error}</p>{/if}
    </form>
  </details>

  {#if session.warnings.length}
    <details class="notes" open>
      <summary>Lưu ý khi đọc file bài học</summary>
      <ul>
        {#each session.warnings as warning, i (i)}
          <li>{warning}</li>
        {/each}
      </ul>
    </details>
  {/if}
</aside>

<style>
  .dossier { margin-top: 2rem; }
  .docs {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
  }
  .doc {
    background: var(--sheet);
    border-radius: var(--radius);
    padding: 0.8rem 0.95rem;
    border-left: 3px solid var(--rule);
  }
  .doc.is-node { border-left-color: var(--ink); }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.25rem 0.75rem; }
  .id { font-weight: 600; font-size: var(--step--1); overflow-wrap: anywhere; }
  .scope { color: var(--muted); font-weight: 400; margin-left: 0.35rem; }
  .text { font-family: var(--serif); font-size: 0.95rem; margin: 0.35rem 0 0; }
  .sources { font-size: var(--step--1); color: var(--muted); margin: 0.4rem 0 0; }

  .notes { margin-top: 1rem; font-size: var(--step--1); color: var(--muted); }
  .notes summary { cursor: pointer; color: var(--ink); font-weight: 500; }
  .notes ul { padding-left: 1.1rem; }
  .doc .btn-link { margin-top: 0.5rem; }
  label { display: block; font-weight: 500; color: var(--ink); margin-top: 0.75rem; }
  label input, label textarea { display: block; margin-top: 0.25rem; }
  textarea { resize: vertical; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: 0 0.6rem; align-items: end; }
  form .btn { margin-top: 0.75rem; }
</style>
