<script lang="ts">
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'

  interface ServiceListEntry {
    key: string
    icon: string
    label: string
  }

  interface Props {
    entries: ServiceListEntry[]
    onOpen: (key: string) => void
  }

  // Mobile only: Services is a drill-down list rather than an expandable nav
  // group, matching the previous UI.
  let { entries, onOpen }: Props = $props()
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS['service-list'])}</p>

<div class="divide-y divide-zinc-200 rounded-base border border-zinc-200">
  {#each entries as e (e.key)}
    <button type="button" class="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-50" onclick={() => onOpen(e.key)}>
      <i class="bi {e.icon} text-base text-zinc-700"></i>
      <span class="flex-1 text-sm font-semibold text-zinc-900">{t(e.label)}</span>
      <i class="bi bi-arrow-right text-zinc-400"></i>
    </button>
  {/each}
</div>
