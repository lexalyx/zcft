<script lang="ts">
  import type { LessonEntry } from "../lib/lesson-source";
  import { library, LOCAL_PREFIX } from "../lib/state.svelte";

  interface Props {
    lessons: LessonEntry[];
    /** Tên file bài trên trang, hoặc LOCAL_PREFIX + id của bài lưu trên máy. */
    selected: string;
    onselect: (value: string) => void;
    onadd: () => void;
    onremove: (id: string) => void;
    onsettings: () => void;
  }

  let { lessons, selected, onselect, onadd, onremove, onsettings }: Props = $props();

  let open = $state(false);

  function run(action: () => void) {
    open = false;
    action();
  }

  function remove(id: string, title: string) {
    if (confirm(`Xoá bài “${title}” khỏi trình duyệt này?`)) onremove(id);
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (open = false)} />

<div class="bar">
  <button type="button" class="menu" aria-expanded={open} aria-controls="sidebar" onclick={() => (open = !open)}>
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
    Bài học
  </button>
  <strong>ZCFT</strong>
</div>

{#if open}<button type="button" class="backdrop" aria-label="Đóng danh sách bài học" onclick={() => (open = false)}></button>{/if}

<aside id="sidebar" class:is-open={open}>
  <p class="brand"><strong>ZCFT</strong> Luyện lập luận pháp lý</p>

  <nav aria-labelledby="lessons-title">
    <h2 id="lessons-title">Bài học</h2>
    {#if lessons.length}
      <ul>
        {#each lessons as lesson (lesson.file)}
          <li>
            <button type="button" class="lesson" aria-current={selected === lesson.file ? "true" : undefined} onclick={() => run(() => onselect(lesson.file))}>
              {lesson.title}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if library.entries.length}
      <h3>Trên máy này</h3>
      <ul>
        {#each library.entries as entry (entry.id)}
          {@const value = LOCAL_PREFIX + entry.id}
          <li>
            <button type="button" class="lesson" aria-current={selected === value ? "true" : undefined} onclick={() => run(() => onselect(value))}>
              {entry.lesson.ten_bai}
            </button>
            <button type="button" class="remove" aria-label="Xoá bài {entry.lesson.ten_bai}" onclick={() => remove(entry.id, entry.lesson.ten_bai)}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if !lessons.length && !library.entries.length}<p class="empty">Chưa có bài học</p>{/if}
    <button type="button" class="btn btn-quiet" onclick={() => run(onadd)}>Thêm bài học</button>
  </nav>

  <button type="button" class="btn btn-quiet" onclick={() => run(onsettings)}>Cài đặt</button>
</aside>

<style>
  aside {
    background: var(--ink);
    color: #fff;
    padding: 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    position: sticky;
    top: 0;
    height: 100dvh;
    overflow-y: auto;
  }
  .brand { margin: 0; font-size: var(--step--1); color: #c8d2e6; }
  .brand strong, .bar strong { color: #fff; font-size: var(--step-0); letter-spacing: 0.04em; }
  .brand strong { display: block; }

  nav { flex: 1; }
  h2, h3 { font-size: var(--step--1); font-weight: 500; color: #c8d2e6; }
  h3 { margin-top: 1.25rem; }
  ul { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 2px; }
  li { display: flex; align-items: stretch; border-radius: var(--radius); }
  li:hover, li:has([aria-current]) { background: var(--ink-hover); }
  .lesson, .remove { font: inherit; color: inherit; background: none; border: none; cursor: pointer; border-radius: var(--radius); }
  .lesson { flex: 1; min-width: 0; text-align: left; padding: 0.5rem 0.6rem; overflow-wrap: anywhere; }
  .lesson[aria-current] { font-weight: 600; box-shadow: inset 3px 0 0 #fff; }
  .remove { flex: none; padding: 0 0.6rem; color: #c8d2e6; display: grid; place-items: center; }
  .remove:hover { color: #fff; }
  .empty { color: #c8d2e6; font-size: var(--step--1); margin: 0.5rem 0 0; }
  .btn-quiet { color: #fff; border-color: #44567c; justify-content: center; }
  .btn-quiet:hover { background: var(--ink-hover); }
  nav .btn { margin-top: 1rem; width: 100%; }
  :focus-visible { outline-color: #fff; }

  .bar, .backdrop { display: none; }

  @media (max-width: 900px) {
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--ink);
      color: #fff;
      padding: 0.6rem var(--gutter);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .menu {
      font: inherit;
      font-weight: 500;
      font-size: var(--step--1);
      color: #fff;
      background: none;
      border: 1px solid #44567c;
      border-radius: var(--radius);
      padding: 0.5rem 0.8rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    aside {
      position: fixed;
      z-index: 4;
      left: 0;
      width: min(19rem, 85vw);
      visibility: hidden;
      transform: translateX(-100%);
    }
    aside.is-open { visibility: visible; transform: none; }
    .backdrop { display: block; position: fixed; inset: 0; z-index: 3; border: none; background: rgba(28, 43, 74, 0.45); }
  }

  @media (max-width: 900px) and (prefers-reduced-motion: no-preference) {
    aside { transition: transform 160ms ease-out, visibility 160ms; }
  }
</style>
