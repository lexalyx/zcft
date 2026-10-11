<script lang="ts">
  import { untrack } from "svelte";
  import { MIN_ANSWER_CHARS } from "../lib/config";
  import { parseGrade } from "../lib/gemini";
  import { renderRichText } from "../lib/markdown";
  import { challengePrompt, gradingPrompt } from "../lib/prompts";
  import { askGemini, errorMessage, requireKey, session, settings } from "../lib/state.svelte";
  import type { LegalDoc } from "../lib/types";
  import GradeView from "./GradeView.svelte";
  import Meter from "./Meter.svelte";

  let { doc, rank }: { doc: LegalDoc; rank: number } = $props();

  const run = session.run;

  let work = $derived(session.workFor(doc.id));
  // Mỗi thẻ gắn với một văn bản cố định (danh sách dựng lại khi đổi bài), nên chỉ cần lấy bài đã lưu lúc tạo thẻ
  let answer = $state(untrack(() => session.workFor(doc.id).answer ?? ""));
  let busy = $state(false);
  let waiting = $derived(session.challengesBusy && !work.challenge);
  let status = $state<{ text: string; error: boolean }>({ text: "", error: false });

  let citations = $derived(new Map((session.lesson?.van_ban ?? []).map((d) => [d.id, d.text])));
  let stale = $derived(answer.trim() !== (work.gradedAnswer ?? "").trim());
  let answerId = $derived(`answer-${doc.id}`);

  function setStatus(text: string, error = false) {
    status = { text, error };
  }

  async function requestChallenge() {
    const lesson = session.lesson;
    if (!lesson || session.run !== run || !requireKey("Cần API key để nhận câu hỏi phản biện.")) {
      busy = false;
      return;
    }
    busy = true;
    try {
      const byId = new Map(lesson.van_ban.map((d) => [d.id, d]));
      const related = (session.retrievedIds ?? []).filter((id) => id !== doc.id).map((id) => byId.get(id));
      const context = [doc, ...related.filter((d) => d !== undefined)];

      setStatus("Luật sư phía đối phương đang soạn câu hỏi…");
      const text = await askGemini(challengePrompt(session.caseText, doc, context), { signal: session.signal });
      if (session.run !== run) return;
      session.updateWork(doc.id, { challenge: { text, contextIds: context.map((d) => d.id), model: settings.model } });
      setStatus("");
    } catch (exc) {
      if (session.run === run) setStatus(errorMessage(exc), true);
    } finally {
      busy = false;
    }
  }

  function newChallenge() {
    session.updateWork(doc.id, { challenge: undefined, grade: undefined, gradedAnswer: undefined });
    void requestChallenge();
  }

  function saveAnswer() {
    session.updateWork(doc.id, { answer });
  }

  async function submit() {
    const lesson = session.lesson;
    const challenge = work.challenge;
    if (!lesson || !challenge) return;
    const text = answer.trim();
    if (text.length < MIN_ANSWER_CHARS) {
      setStatus(`Lập luận cần ít nhất ${MIN_ANSWER_CHARS} ký tự.`, true);
      return;
    }
    if (!requireKey("Cần API key để chấm bài.")) return;
    const byId = new Map(lesson.van_ban.map((d) => [d.id, d]));
    const context = challenge.contextIds.map((id) => byId.get(id)).filter((d) => d !== undefined);

    busy = true;
    setStatus("Gemini đang chấm bài…");
    try {
      const raw = await askGemini(gradingPrompt(challenge.text, context, text), { json: true, signal: session.signal });
      let grade;
      try {
        grade = parseGrade(raw);
      } catch {
        throw new Error("Gemini trả kết quả chấm không đúng định dạng. Bấm nộp lại.");
      }
      if (session.run !== run) return;
      session.updateWork(doc.id, { grade, gradedAnswer: text, answer });
      setStatus("");
    } catch (exc) {
      if (session.run === run) setStatus(errorMessage(exc), true);
    } finally {
      busy = false;
    }
  }
</script>

<details class="node" open>
  <summary>
    <span class="title"><span class="rank">{rank}.</span>{doc.id}{#if doc.jurisdiction}<span class="scope">{doc.jurisdiction}</span>{/if}</span>
    <span class="meta">
      {#if work.grade}<span class="done">Đã chấm: {work.grade.trs.toFixed(2)}</span>{/if}
      <Meter score={session.report?.scores.get(doc.id) ?? 0} base={session.report?.base.get(doc.id)} />
    </span>
  </summary>

  <div class="body">
    <p class="doc">{doc.text}</p>

    {#if !work.challenge}
      <button type="button" class="btn btn-primary" disabled={busy || waiting} onclick={requestChallenge}>Nhận câu hỏi phản biện</button>
    {:else}
      <div class="memo">
        <p class="from">Luật sư phía đối phương</p>
        <div class="memo-text">{@html renderRichText(work.challenge.text, citations)}</div>
        <div class="memo-meta">
          <span>Căn cứ đưa cho AI: {work.challenge.contextIds.join(", ")}</span>
          <button type="button" class="btn-link" disabled={busy || waiting} onclick={newChallenge}>Đổi câu hỏi khác</button>
        </div>
      </div>

      <label class="answer-label" for={answerId}>Lập luận của bạn</label>
      <textarea id={answerId} class="answer" spellcheck="true" bind:value={answer} oninput={saveAnswer}></textarea>
      <div class="answer-foot">
        <span class="count">{answer.trim().length} ký tự</span>
        <button type="button" class="btn btn-primary" disabled={busy || waiting} onclick={submit}>Nộp bài và xem đánh giá</button>
      </div>
    {/if}

    {#if waiting}
      <p class="status" role="status">Luật sư phía đối phương đang soạn câu hỏi…</p>
    {:else if status.text}
      <p class="status" class:is-error={status.error} role="status">{status.text}</p>
    {/if}

    {#if work.challenge && work.grade}
      <GradeView grade={work.grade} {stale} />
    {/if}
  </div>
</details>

<style>
  .node {
    background: var(--sheet);
    border-radius: var(--radius);
    margin-bottom: 0.85rem;
    border: 1px solid transparent;
  }
  .node[open] { border-color: var(--rule); }
  summary {
    list-style: none;
    cursor: pointer;
    padding: 0.9rem 1.1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }
  summary::-webkit-details-marker { display: none; }
  .title { font-weight: 600; overflow-wrap: anywhere; }
  .rank { color: var(--muted); font-weight: 400; margin-right: 0.35rem; }
  .scope { color: var(--muted); font-weight: 400; margin-left: 0.35rem; }
  .meta { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; }
  .done { font-size: var(--step--1); color: var(--pen); font-weight: 500; }
  .body { padding: 0 1.1rem 1.2rem; }
  .doc { font-family: var(--serif); margin: 0 0 0.6rem; max-width: 72ch; }

  .memo {
    margin: 1rem 0 0.5rem;
    background: var(--stamp-soft);
    border-left: 3px solid var(--stamp);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 0.85rem 1rem;
  }
  .from { color: var(--stamp); font-weight: 600; font-size: var(--step--1); margin: 0 0 0.35rem; }
  .memo-text { font-family: var(--serif); font-size: var(--step-1); line-height: 1.6; }
  .memo-text :global(p) { margin: 0 0 0.6em; }
  .memo-text :global(p:last-child) { margin-bottom: 0; }
  .memo-text :global(ul) { margin: 0.3em 0; padding-left: 1.2rem; }
  .memo-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--step--1);
    color: var(--muted);
    margin-top: 0.6rem;
  }

  .answer-label { display: block; font-weight: 600; color: var(--pen); margin-top: 1.1rem; }
  .answer {
    --lh: 1.8rem;
    display: block;
    margin-top: 0.4rem;
    min-height: calc(var(--lh) * 7 + 0.5rem);
    resize: vertical;
    color: var(--pen);
    line-height: var(--lh);
    padding: 0.25rem 0.9rem 0.25rem 2.6rem;
    border-color: var(--line);
    background-color: #fff;
    background-image:
      linear-gradient(to right, transparent 1.85rem, var(--margin) 1.85rem, var(--margin) calc(1.85rem + 1px), transparent calc(1.85rem + 1px)),
      repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--lh) - 1px), var(--line) calc(var(--lh) - 1px), var(--line) var(--lh));
    background-position: 0 0.25rem;
    background-attachment: local;
  }
  .answer:focus { border-color: var(--pen); }
  .answer-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: 0.6rem; }
  .count { font-size: var(--step--1); color: var(--muted); font-variant-numeric: tabular-nums; }

  @media (prefers-reduced-motion: no-preference) {
    .node[open] .body { animation: unfold 160ms ease-out; }
    @keyframes unfold {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: none; }
    }
  }
</style>
