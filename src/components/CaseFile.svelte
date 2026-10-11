<script lang="ts">
  import { retrieve } from "../lib/retrieval";
  import { modelStatus, session, settings } from "../lib/state.svelte";
  import type { Lesson } from "../lib/types";

  let { lesson }: { lesson: Lesson } = $props();

  let busy = $state(false);
  let error = $state("");
  let retrieved = $derived.by(() => {
    const byId = new Map(lesson.van_ban.map((d) => [d.id, d]));
    return (session.retrievedIds ?? []).map((id) => byId.get(id)).filter((d) => d !== undefined);
  });

  async function analyze(event: SubmitEvent) {
    event.preventDefault();
    const text = session.caseText.trim();
    if (!text) {
      error = "Nhập tình huống trước khi phân tích.";
      return;
    }
    error = "";
    busy = true;
    const run = session.run;
    try {
      const found = await retrieve(text, lesson.van_ban, lesson.settings.topK, settings.embedModel);
      if (found.error) modelStatus.text = `Không dùng được mô hình tìm theo nghĩa (${found.error}). Đang tìm theo từ ngữ.`;
      if (session.run !== run) return;
      session.setRetrieved(found.results.map((r) => r.doc.id));
      void session.fillChallenges();
    } finally {
      busy = false;
    }
  }

  function reset() {
    if (!confirm("Xoá câu hỏi, bài làm và điểm của bài này?")) return;
    error = "";
    session.reset();
  }
</script>

<section class="case">
  <h1>{lesson.ten_bai}</h1>
  <form onsubmit={analyze}>
    <label for="case-text">Hồ sơ vụ việc</label>
    <textarea id="case-text" rows="8" value={session.caseText} oninput={(e) => session.setCaseText(e.currentTarget.value)}></textarea>
    <div class="actions">
      <button type="submit" class="btn btn-primary" disabled={busy}>Phân tích rủi ro</button>
      {#if session.retrievedIds !== null}
        <button type="button" class="btn btn-quiet" disabled={busy} onclick={reset}>Làm lại từ đầu</button>
      {/if}
    </div>
    {#if error}
      <p class="status is-error" role="alert">{error}</p>
    {:else if busy}
      <p class="status" role="status">Đang tìm căn cứ liên quan…</p>
    {/if}
    {#if modelStatus.text}<p class="model-status" role="status">{modelStatus.text}</p>{/if}
  </form>

  {#if retrieved.length}
    <h2>Căn cứ liên quan nhất tới tình huống</h2>
    <ul class="found">
      {#each retrieved as doc (doc.id)}
        <li>
          <span class="id">{doc.id}{#if doc.jurisdiction}<span class="scope">{doc.jurisdiction}</span>{/if}</span>
          <p>{doc.text}</p>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .case { padding: 2.25rem 0 0; }
  h1 {
    font-family: var(--serif);
    font-weight: 600;
    font-size: var(--step-3);
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  label { display: block; font-weight: 600; margin: 1.25rem 0 0.4rem; }
  textarea { display: block; font-family: var(--serif); font-size: var(--step-1); line-height: 1.6; resize: vertical; margin-bottom: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .model-status { font-size: var(--step--1); color: var(--pen); margin: 0.5rem 0 0; }

  h2 { margin-top: 1.5rem; }
  .found { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem; }
  .found li { background: var(--sheet); border-radius: var(--radius); padding: 0.8rem 0.95rem; }
  .id { font-weight: 600; font-size: var(--step--1); overflow-wrap: anywhere; }
  .scope { color: var(--muted); font-weight: 400; margin-left: 0.35rem; }
  .found p { font-family: var(--serif); font-size: 0.95rem; margin: 0.35rem 0 0; }
</style>
