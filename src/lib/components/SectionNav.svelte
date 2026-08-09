<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import type { NavItem } from '../nav.js'

  interface Props {
    // Already filtered by the caller, which owns the document the predicates
    // read; filtering again here would be a second rule to keep in step.
    items?: NavItem[]
    // The children of each `group: true` item, keyed by that item's key. Passed
    // in rather than imported: a connected device narrows them to the packages
    // it actually has installed.
    groups?: Record<string, NavItem[]>
    page?: string
    onSelect: (key: string) => void
    changes?: number
  }

  let { items = [], groups = {}, page, onSelect, changes = 0 }: Props = $props()

  function holds(key: string): boolean {
    return (groups[key] ?? []).some((c) => c.key === page)
  }

  // Collapsed by default: a group is long enough to bury the rest of the
  // section. Arriving on one of its pages opens it so the active entry is not
  // hidden, which also covers a deep link straight into one.
  let open = $state<Record<string, boolean>>({})
  $effect(() => {
    for (const key of Object.keys(groups)) {
      if (holds(key)) open[key] = true
    }
  })
</script>

<nav class="flex h-full w-[172px] flex-shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-surface">
  {#each items as i (i.key)}
    {#if i.group}
      {@const isOpen = open[i.key] ?? false}
      <button
        type="button"
        class="nav-section-header {isOpen ? 'nav-section-header-open' : ''} {holds(i.key) && !isOpen ? 'text-accent' : ''}"
        aria-expanded={isOpen}
        onclick={() => (open[i.key] = !isOpen)}
      >
        <i class="bi {i.icon} text-base"></i>
        <span class="flex-1">{t(i.label)}</span>
        <i class="bi {isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-xs text-zinc-400"></i>
      </button>
      {#if isOpen}
        {#each groups[i.key] ?? [] as e (e.key)}
          <button
            type="button"
            class="nav-subitem {page === e.key ? 'nav-subitem-active' : ''}"
            onclick={() => onSelect(e.key)}
          >
            <i class="bi {e.icon} text-base"></i>
            <span class="flex-1">{t(e.label)}</span>
          </button>
        {/each}
      {/if}
    {:else}
      <button
        type="button"
        class="nav-item {page === i.key ? 'nav-item-active' : ''}"
        onclick={() => onSelect(i.key)}
      >
        <i class="bi {i.icon} text-base"></i>
        <span class="flex-1">{t(i.label)}</span>
        {#if i.key === 'changes' && changes}
          <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">
            {changes}
          </span>
        {/if}
      </button>
    {/if}
  {/each}
</nav>
