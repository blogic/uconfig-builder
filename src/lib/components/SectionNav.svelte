<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import { SERVICE_ENTRIES } from '../nav.js'
  import type { NavItem } from '../nav.js'

  interface Props {
    items?: NavItem[]
    page?: string
    onSelect: (key: string) => void
    changes?: number
  }

  let { items = [], page, onSelect, changes = 0 }: Props = $props()

  let servicesOpen = $state(true)

  const inServices = $derived(page?.startsWith('service:') || page === 'ntp')
  const visible = $derived(items.filter((i) => !i.whenChanges || changes > 0))
</script>

<nav class="flex h-full w-[172px] flex-shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-surface">
  {#each visible as i (i.key)}
    {#if i.group}
      <button
        type="button"
        class="nav-section-header {servicesOpen ? 'nav-section-header-open' : ''} {inServices && !servicesOpen ? 'text-accent' : ''}"
        aria-expanded={servicesOpen}
        onclick={() => (servicesOpen = !servicesOpen)}
      >
        <i class="bi {i.icon} text-base"></i>
        <span class="flex-1">{t(i.label)}</span>
        <i class="bi {servicesOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-xs text-zinc-400"></i>
      </button>
      {#if servicesOpen}
        {#each SERVICE_ENTRIES as e (e.key)}
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
