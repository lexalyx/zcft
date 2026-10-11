<script lang="ts">
  import { TEMPLATE_URL } from "../lib/config";
  import { docError, normalizeLesson } from "../lib/lesson";
  import type { Lesson } from "../lib/types";

  interface Props {
    open: boolean;
    onopenfile: (file: File) => void;
    onsave: (lesson: Lesson) => void;
  }

  let { open = $bindable(), onopenfile, onsave }: Props = $props();

  const blankDoc = () => ({ id: "", jurisdiction: "", rui_ro: "", text: "" });

  let dialog: HTMLDialogElement;
  let fileInput: HTMLInputElement;
  let title = $state("");
  let caseText = $state("");
  let docs = $state([blankDoc()]);
  let error = $state("");

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function pickFile() {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    open = false;
    onopenfile(file);
  }

  function save() {
    const filled = docs.filter((d) => d.id.trim() || d.text.trim());
    const taken = new Set<string>();
    error = "";
    if (!title.trim() || !caseText.trim()) error = "Nhập tên bài và tình huống.";
    else if (!filled.length) error = "Thêm ít nhất một văn bản.";
    for (const doc of filled) {
      error ||= docError(doc.id, doc.text, taken);
      taken.add(doc.id.trim());
    }
    if (error) return;
    onsave(normalizeLesson({ ten_bai: title, tinh_huong: caseText, van_ban: filled }).lesson);
    title = "";
    caseText = "";
    docs = [blankDoc()];
    open = false;
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="lesson-dialog-title">
  <div class="body">
    <h2 id="lesson-dialog-title">Thêm bài học</h2>
    <p class="hint">Chỉ lưu trong trình duyệt này, người khác không thấy.</p>

    <section>
      <h3>Từ file Excel</h3>
      <div class="actions">
        <button type="button" class="btn btn-primary" onclick={() => fileInput.click()}>Chọn file Excel</button>
        <a class="btn btn-quiet" href={TEMPLATE_URL} download>Tải file Excel mẫu</a>
      </div>
      <input type="file" accept=".xlsx" hidden bind:this={fileInput} onchange={pickFile} />
    </section>

    <section>
      <h3>Hoặc nhập tay</h3>
      <label>Tên bài <input type="text" bind:value={title} /></label>
      <label>Tình huống <textarea rows="4" bind:value={caseText}></textarea></label>

      {#each docs as doc, i (doc)}
        <fieldset>
          <legend>Văn bản {i + 1}</legend>
          <div class="row">
            <label>Mã <input type="text" spellcheck="false" bind:value={doc.id} /></label>
            <label>Phạm vi <input type="text" spellcheck="false" bind:value={doc.jurisdiction} /></label>
            <label>Rủi ro gốc (0–1) <input type="text" inputmode="decimal" bind:value={doc.rui_ro} /></label>
          </div>
          <label>Nội dung tóm tắt <textarea rows="3" bind:value={doc.text}></textarea></label>
          {#if docs.length > 1}
            <button type="button" class="btn-link" onclick={() => docs.splice(i, 1)}>Xoá văn bản {i + 1}</button>
          {/if}
        </fieldset>
      {/each}
      <button type="button" class="btn btn-quiet" onclick={() => docs.push(blankDoc())}>Thêm văn bản</button>
      {#if error}<p class="status is-error" role="alert">{error}</p>{/if}
    </section>

    <div class="footer">
      <button type="button" class="btn btn-quiet" onclick={() => (open = false)}>Đóng</button>
      <button type="button" class="btn btn-primary" onclick={save}>Lưu bài học</button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 10px;
    padding: 0;
    width: min(40rem, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    color: var(--ink);
    box-shadow: 0 20px 60px rgba(28, 43, 74, 0.25);
  }
  dialog::backdrop { background: rgba(28, 43, 74, 0.45); }
  .body { padding: 1.4rem 1.5rem; }
  h2 { font-size: var(--step-2); }
  h3 { font-size: var(--step-0); font-weight: 600; }
  section { margin-top: 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--rule); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
  label { display: block; font-size: var(--step--1); font-weight: 500; margin-top: 0.75rem; }
  label input, label textarea { display: block; margin-top: 0.25rem; }
  textarea { resize: vertical; }
  fieldset { border: 1px solid var(--rule); border-radius: var(--radius); margin: 1rem 0 0; padding: 0 0.9rem 0.9rem; min-width: 0; }
  legend { font-size: var(--step--1); font-weight: 600; padding: 0 0.3rem; }
  fieldset .btn-link { margin-top: 0.75rem; }
  .row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.6rem; align-items: end; }
  section > .btn { margin-top: 1rem; }
  .footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }

  @media (max-width: 520px) {
    .row { grid-template-columns: minmax(0, 1fr); gap: 0; }
  }
</style>
