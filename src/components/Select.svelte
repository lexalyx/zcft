<script lang="ts">
  interface Props {
    id: string;
    value: string;
    options: { value: string; label: string }[];
    onchange: (value: string) => void;
    label?: string;
    /** Hiện khi không có lựa chọn nào khớp `value`. */
    placeholder?: string;
  }

  let { id, value, options, onchange, label, placeholder = "" }: Props = $props();

  let selected = $derived(options.findIndex((o) => o.value === value));

  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement;
  let list = $state<HTMLUListElement>();

  function show() {
    active = Math.max(0, selected);
    open = true;
  }

  function pick(index: number) {
    open = false;
    const option = options[index];
    if (option && option.value !== value) onchange(option.value);
  }

  function optionAt(event: Event): number {
    const item = (event.target as HTMLElement).closest("li");
    return item ? Number(item.dataset.index) : -1;
  }

  function onkeydown(event: KeyboardEvent) {
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }
    if (key === "Tab") {
      open = false;
      return;
    }
    const last = options.length - 1;
    if (key === "ArrowDown") active = Math.min(last, active + 1);
    else if (key === "ArrowUp") active = Math.max(0, active - 1);
    else if (key === "Home") active = 0;
    else if (key === "End") active = last;
    else if (key === "Enter" || key === " ") pick(active);
    else if (key === "Escape") open = false;
    else return;
    // Escape không được lọt ra ngoài, kẻo đóng luôn hộp thoại chứa nó.
    event.preventDefault();
    event.stopPropagation();
  }

  $effect(() => {
    if (open) list?.children[active]?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="select" bind:this={root} onfocusout={(e) => !root.contains(e.relatedTarget as Node | null) && (open = false)}>
  <button
    type="button"
    {id}
    role="combobox"
    aria-haspopup="listbox"
    aria-label={label}
    disabled={!options.length}
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-activedescendant={open ? `${id}-option-${active}` : undefined}
    onclick={() => (open ? (open = false) : show())}
    {onkeydown}
  >
    <span class="value">{options[selected]?.label ?? placeholder}</span>
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  {#if open}
    <ul
      id="{id}-list"
      role="listbox"
      tabindex="-1"
      bind:this={list}
      onmousedown={(e) => e.preventDefault()}
      onpointermove={(e) => optionAt(e) >= 0 && (active = optionAt(e))}
      onclick={(e) => pick(optionAt(e))}
      {onkeydown}
    >
      {#each options as option, i (option.value)}
        <li id="{id}-option-{i}" role="option" aria-selected={i === selected} class:is-active={i === active} data-index={i}>{option.label}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .select { position: relative; }
  button {
    font: inherit;
    color: var(--ink);
    background: var(--sheet);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 0.55rem 0.7rem;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    text-align: left;
    cursor: pointer;
  }
  button:disabled { cursor: not-allowed; color: var(--muted); }
  .value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  svg { flex: none; color: var(--muted); }
  button[aria-expanded="true"] svg { transform: rotate(180deg); }

  ul {
    position: absolute;
    z-index: 1;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    max-height: 15rem;
    overflow: auto;
    background: var(--sheet);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(28, 43, 74, 0.16);
  }
  li { padding: 0.45rem 0.6rem; border-radius: 4px; cursor: pointer; overflow-wrap: anywhere; }
  li.is-active { background: var(--bg); }
  li[aria-selected="true"] { font-weight: 600; }
</style>
