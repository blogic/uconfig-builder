<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Item {
    key: string
    label: string
    icon: string
    badge?: number | string
  }

  interface Props {
    items: Item[]
    active: string
    onSelect: (key: string) => void
  }

  let { items, active, onSelect }: Props = $props()
</script>

<nav class="bottom-nav">
  {#each items as item (item.key)}
    <button
      type="button"
      class="bottom-nav-item {active === item.key ? 'bottom-nav-item-active' : ''}"
      aria-current={active === item.key ? 'page' : undefined}
      onclick={() => onSelect(item.key)}
    >
      <span class="relative">
        <i class="bi {item.icon}"></i>
        {#if item.badge}
          <span class="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-ink">
            {item.badge}
          </span>
        {/if}
      </span>
      <span>{t(item.label)}</span>
    </button>
  {/each}
</nav>
