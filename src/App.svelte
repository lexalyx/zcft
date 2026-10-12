<script lang="ts">
  import { onMount } from "svelte";
  import CaseFile from "./components/CaseFile.svelte";
  import DocList from "./components/DocList.svelte";
  import ExportBar from "./components/ExportBar.svelte";
  import Guide from "./components/Guide.svelte";
  import LessonDialog from "./components/LessonDialog.svelte";
  import NodeCard from "./components/NodeCard.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import { fetchLessonIndex, loadLocalLesson, loadSiteLesson, type LessonEntry, type LoadedLesson } from "./lib/lesson-source";
  import * as storage from "./lib/storage";
  import { errorMessage, library, LOCAL_PREFIX, session, settings, settingsDialog } from "./lib/state.svelte";
  import type { Lesson } from "./lib/types";

  const GUIDE_HASH = "#huong-dan";

  let lessons = $state<LessonEntry[]>([]);
  let selected = $state("");
  let pageStatus = $state("Đang mở bài học…");
  let indexLoaded = $state(false);
  let adding = $state(false);
  let guide = $state(location.hash === GUIDE_HASH);

  let docById = $derived(new Map((session.lesson?.van_ban ?? []).map((d) => [d.id, d])));

  function show(lesson: Lesson, warnings: string[], value: string) {
    session.open(lesson, warnings);
    void session.fillChallenges();
    document.title = `${lesson.ten_bai} – ZCFT`;
    pageStatus = "";
    selected = value;
    storage.save("lastLesson", value);
  }

  async function open(load: () => Promise<LoadedLesson>, busyText: string): Promise<LoadedLesson | null> {
    pageStatus = busyText;
    try {
      return await load();
    } catch (exc) {
      pageStatus = `Không mở được bài học: ${errorMessage(exc)}`;
      return null;
    }
  }

  async function selectLesson(value: string) {
    if (guide) location.hash = "";
    if (value.startsWith(LOCAL_PREFIX)) {
      const entry = library.entries.find((e) => LOCAL_PREFIX + e.id === value);
      if (entry) show(entry.lesson, entry.warnings, value);
      return;
    }
    selected = value;
    const loaded = await open(() => loadSiteLesson(value), "Đang mở bài học…");
    if (loaded) show(loaded.lesson, loaded.warnings, value);
  }

  async function openFile(file: File) {
    const loaded = await open(() => loadLocalLesson(file), `Đang đọc ${file.name}…`);
    if (loaded) show(loaded.lesson, loaded.warnings, LOCAL_PREFIX + library.add(loaded.lesson, loaded.warnings));
  }

  function firstLesson(): string {
    return lessons[0]?.file ?? (library.entries[0] ? LOCAL_PREFIX + library.entries[0].id : "");
  }

  function removeSaved(id: string) {
    library.remove(id);
    if (selected !== LOCAL_PREFIX + id) return;
    const next = firstLesson();
    if (next) void selectLesson(next);
    else {
      session.close();
      selected = "";
    }
  }

  onMount(() => {
    if (settings.apiKey) void settings.verifyKey();
    void (async () => {
      lessons = await fetchLessonIndex();
      indexLoaded = true;
      const last = storage.load("lastLesson", "");
      const known = lessons.some((l) => l.file === last) || library.entries.some((e) => LOCAL_PREFIX + e.id === last);
      const start = known ? last : firstLesson();
      if (start) await selectLesson(start);
      else pageStatus = "";
    })();
  });
</script>

<svelte:window onhashchange={() => (guide = location.hash === GUIDE_HASH)} />

<div class="shell">
  <Sidebar {lessons} selected={guide ? "" : selected} guideHref={GUIDE_HASH} guideOpen={guide} onselect={selectLesson} onadd={() => (adding = true)} onremove={removeSaved} onsettings={() => settingsDialog.show()} />

  <div class="page">
    <main>
      {#if !settings.apiKey}
        <div class="notice">
          <p>Để nhận câu hỏi và được chấm bài, bạn cần một API key Gemini miễn phí của riêng bạn.</p>
          <button type="button" class="btn btn-primary" onclick={() => settingsDialog.show()}>Nhập API key</button>
        </div>
      {:else if settings.keyStatus.kind === "error"}
        <div class="notice">
          <p>Chưa dùng được API key: {settings.keyStatus.text}</p>
          <button type="button" class="btn btn-primary" onclick={() => settingsDialog.show()}>Mở cài đặt</button>
        </div>
      {/if}

      {#if guide}<Guide />{/if}
      <div hidden={guide}>
        {#if pageStatus}
          <p class="loading" role="status">{pageStatus}</p>
        {:else if indexLoaded && !session.lesson}
          <div class="notice">
            <p>Chưa có bài học nào.</p>
            <button type="button" class="btn btn-primary" onclick={() => (adding = true)}>Thêm bài học</button>
          </div>
        {/if}

        {#if session.lesson}
          <div class="workspace" class:is-analyzed={session.retrievedIds !== null}>
            <div class="side">
              <CaseFile lesson={session.lesson} />
              <DocList />
            </div>

            {#if session.retrievedIds !== null}
              <section class="arena" aria-labelledby="arena-title">
                <header>
                  <h2 id="arena-title">Mắt xích phía đối phương sẽ tấn công</h2>
                  <p class="hint">Lập luận cần đủ 3 lớp: pháp luật quốc gia, điều ước hoặc chuẩn mực quốc tế, giải pháp hòa giải.</p>
                  {#if session.challengesError}<p class="status is-error" role="alert">{session.challengesError}</p>{/if}
                </header>

                {#key session.lessonKey}
                  {#each session.nodes as id, i (id)}
                    {@const doc = docById.get(id)}
                    {#if doc}<NodeCard {doc} rank={i + 1} />{/if}
                  {:else}
                    <p class="hint">
                      Không có văn bản nào đạt ngưỡng rủi ro {session.lesson.settings.threshold.toFixed(2)}. Giảng viên có thể hạ “Ngưỡng rủi ro” trong
                      trang Thông tin của file Excel.
                    </p>
                  {/each}
                {/key}

                <ExportBar />
              </section>
            {/if}
          </div>
        {/if}
      </div>
    </main>

    <footer>
      <p>
      </p>
    </footer>

  </div>
</div>

<SettingsDialog />
<LessonDialog bind:open={adding} onopenfile={openFile} onsave={(lesson) => show(lesson, [], LOCAL_PREFIX + library.add(lesson, []))} />

<style>
  .shell { display: grid; grid-template-columns: 17rem minmax(0, 1fr); align-items: start; }

  main { max-width: var(--page); margin: 0 auto; padding: 0 var(--gutter) 3rem; }

  .notice {
    margin-top: 1.25rem;
    background: var(--pen-soft);
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
  }
  .notice p { margin: 0; max-width: 60ch; }
  .loading { color: var(--muted); padding: 2rem 0; }

  .workspace {
    display: grid;
    gap: 2rem;
    grid-template-columns: minmax(0, 78ch);
    align-items: start;
  }
  .workspace.is-analyzed { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
  .arena { padding-top: 2.25rem; }
  .arena header { margin-bottom: 1rem; }
  .arena .hint { max-width: 70ch; }

  footer {
    max-width: var(--page);
    margin: 0 auto;
    padding: 1.5rem var(--gutter) 2.5rem;
    color: var(--muted);
    font-size: var(--step--1);
    border-top: 1px solid var(--rule);
  }
  footer p { max-width: 80ch; margin: 0; }

  @media (max-width: 900px) {
    .shell { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 1180px) {
    .workspace, .workspace.is-analyzed { grid-template-columns: minmax(0, 1fr); }
    .arena { padding-top: 0; }
    .side { display: contents; }
    .workspace :global(.dossier) { order: 1; margin-top: 0; }
  }
</style>
