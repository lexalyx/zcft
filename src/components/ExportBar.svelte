<script lang="ts">
  import { buildResultsWorkbook } from "../lib/excel";
  import { plain } from "../lib/lesson";
  import * as storage from "../lib/storage";
  import { errorMessage, session, settings } from "../lib/state.svelte";

  let student = $state(storage.load("student", ""));
  let status = $state({ text: "", error: false });
  let input: HTMLInputElement;

  const slug = (text: string, max = 40) => plain(text).replace(/\s+/g, "-").slice(0, max);

  async function exportResults(event: SubmitEvent) {
    event.preventDefault();
    const { lesson, report } = session;
    if (!lesson || !report) return;
    const name = student.trim();
    if (!name) {
      status = { text: "Nhập họ tên và MSSV trước khi tải bài làm.", error: true };
      input.focus();
      return;
    }
    storage.save("student", name);
    const rows = session.nodes
      .map((docId, i) => {
        const work = session.workFor(docId);
        return {
          rank: i + 1,
          docId,
          risk: report.scores.get(docId) ?? 0,
          challenge: work.challenge?.text ?? "",
          answer: (work.answer ?? "").trim(),
          grade: work.grade ?? null,
        };
      })
      .filter((row) => row.challenge || row.answer);
    if (!rows.length) {
      status = { text: "Chưa có bài làm nào để tải.", error: true };
      return;
    }
    try {
      status = { text: "Đang tạo file…", error: false };
      const blob = await buildResultsWorkbook({ student: name, lesson, caseText: session.caseText.trim(), model: settings.model, rows });
      const fileName = `bai-lam_${slug(name)}_${slug(lesson.ten_bai)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      status = { text: `Đã tải ${fileName}.`, error: false };
    } catch (exc) {
      status = { text: `Không tạo được file: ${errorMessage(exc)}`, error: true };
    }
  }
</script>

<form class="export" onsubmit={exportResults}>
  <label for="student-name">Họ tên và MSSV</label>
  <div class="row">
    <input type="text" id="student-name" autocomplete="name" bind:value={student} bind:this={input} />
    <button type="submit" class="btn btn-primary">Tải bài làm (Excel)</button>
  </div>
  {#if status.text}
    <p class="status" class:is-error={status.error} role="status">{status.text}</p>
  {/if}
</form>

<style>
  .export { margin-top: 1.75rem; background: var(--sheet); border-radius: var(--radius); padding: 1rem 1.1rem; }
  label { font-weight: 600; display: block; margin-bottom: 0.4rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .row input { flex: 1 1 16rem; width: auto; }
</style>
