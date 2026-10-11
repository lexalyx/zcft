<script lang="ts">
  import { API_KEY_URL, EMBED_MODELS } from "../lib/config";
  import { settings, settingsDialog } from "../lib/state.svelte";
  import Select from "./Select.svelte";

  let dialog: HTMLDialogElement;
  let keyInput: HTMLInputElement;
  let keyDraft = $state("");
  let remember = $state(false);
  let modelDraft = $state("");

  const embedOptions = [
    ...EMBED_MODELS.map((m) => ({ value: m.id, label: `${m.id.replace("Xenova/", "")} (${m.downloadMb} MB)` })),
    { value: "", label: "Không dùng mô hình, tìm theo từ ngữ" },
  ];

  $effect(() => {
    if (settingsDialog.open && !dialog.open) {
      keyDraft = settings.apiKey;
      remember = settings.rememberKey;
      modelDraft = settings.model;
      dialog.showModal();
      if (!settings.apiKey) keyInput.focus();
    } else if (!settingsDialog.open && dialog.open) {
      dialog.close();
    }
  });

  function saveKey() {
    settings.setApiKey(keyDraft, remember);
    void settings.verifyKey();
  }

  function forgetKey() {
    keyDraft = "";
    settings.setApiKey("", false);
    settings.keyStatus = { text: "Đã xoá key khỏi trình duyệt này.", kind: "" };
  }

  function onClose() {
    settingsDialog.open = false;
    if (keyDraft.trim() && keyDraft.trim() !== settings.apiKey) saveKey();
  }

  $effect(() => {
    modelDraft = settings.model;
  });
</script>

<dialog bind:this={dialog} onclose={onClose} aria-labelledby="settings-title">
  <form method="dialog">
    <h2 id="settings-title">Cài đặt</h2>
    {#if settingsDialog.note}<p class="note">{settingsDialog.note}</p>{/if}

    <div class="field">
      <label for="api-key">API key Gemini</label>
      <input type="password" id="api-key" autocomplete="off" spellcheck="false" placeholder="AIza…" bind:value={keyDraft} bind:this={keyInput} />
      <p class="hint">
        Tạo miễn phí tại <a href={API_KEY_URL} target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Key chỉ nằm trong trình duyệt này
        và chỉ được gửi tới Google.
      </p>
      <label class="check"><input type="checkbox" bind:checked={remember} onchange={() => settings.apiKey && settings.setApiKey(settings.apiKey, remember)} /> Ghi nhớ key trên máy này</label>
      <div class="actions">
        <button type="button" class="btn btn-primary" onclick={saveKey}>Lưu và kiểm tra key</button>
        <button type="button" class="btn btn-quiet" onclick={forgetKey}>Xoá key</button>
      </div>
      {#if settings.keyStatus.text}
        <p class="status" class:is-ok={settings.keyStatus.kind === "ok"} class:is-error={settings.keyStatus.kind === "error"} role="status">
          {settings.keyStatus.text}
        </p>
      {/if}
    </div>

    <div class="field">
      <label for="model-input">Model Gemini</label>
      {#if settings.models.length}
        <Select id="model-input" value={settings.model} options={settings.models.map((m) => ({ value: m, label: m }))} onchange={(model) => settings.setModel(model)} />
      {:else}
        <input type="text" id="model-input" spellcheck="false" bind:value={modelDraft} onchange={() => settings.setModel(modelDraft)} />
      {/if}
    </div>

    <div class="field">
      <label for="embed-input">Mô hình embedding</label>
      <Select id="embed-input" value={settings.embedModelId} options={embedOptions} onchange={(id) => settings.setEmbedModel(id)} />
      {#if settings.embedModel}<p class="hint">Tải về máy ở lần phân tích đầu tiên.</p>{/if}
    </div>

    <p class="privacy">
      Với key miễn phí, Google có thể dùng nội dung gửi lên (cả bài làm) để cải thiện sản phẩm và người của Google có thể đọc. Đừng ghi thông
      tin cá nhân vào bài làm. Theo điều khoản của Google, người dùng Gemini API phải từ 18 tuổi trở lên.
    </p>

    <div class="footer">
      <button type="submit" class="btn btn-quiet">Đóng</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 10px;
    padding: 0;
    width: min(36rem, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    color: var(--ink);
    box-shadow: 0 20px 60px rgba(28, 43, 74, 0.25);
  }
  dialog::backdrop { background: rgba(28, 43, 74, 0.45); }
  form { padding: 1.4rem 1.5rem; }
  h2 { font-size: var(--step-2); margin-bottom: 0.75rem; }
  .note { background: var(--pen-soft); border-radius: var(--radius); padding: 0.6rem 0.8rem; margin: 0 0 1rem; }
  .field { margin-bottom: 1.3rem; }
  .field > label:first-child:not(.check) { font-weight: 600; display: block; margin-bottom: 0.35rem; }
  .field .check { margin-top: 0.6rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
  .privacy { font-size: var(--step--1); color: var(--muted); background: var(--bg); border-radius: var(--radius); padding: 0.7rem 0.85rem; }
  .footer { display: flex; justify-content: flex-end; margin-top: 1rem; }
</style>
