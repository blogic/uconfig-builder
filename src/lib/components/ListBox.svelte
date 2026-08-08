<script lang="ts" generics="T">
  import AddButton from './AddButton.svelte'
  import { t } from '../i18n.svelte.js'
  import type { Snippet } from 'svelte'

  interface Props {
    items: T[]
    label?: string | null
    showAdd?: boolean
    onAdd?: ((e: MouseEvent) => void) | null
    emptyText?: string
    row: Snippet<[item: T, index: number]>
  }

  let {
    items,
    label = null,
    showAdd = true,
    onAdd = null,
    emptyText = 'No entries',
    row
  }: Props = $props()
</script>

<div class="flex max-w-sm flex-col gap-2">
  {#if label}
    <span class="text-xs font-medium text-zinc-700">{t(label)}</span>
  {/if}
  <div class="overflow-hidden rounded-base border border-zinc-200">
    {#each items as item, i (i)}
      <div class="flex items-center gap-2 border-b border-zinc-100 bg-surface px-3 py-1.5 last:border-b-0">
        {@render row(item, i)}
      </div>
    {:else}
      <div class="bg-surface px-3 py-1.5 text-xs text-zinc-400">{t(emptyText)}</div>
    {/each}
  </div>
  {#if showAdd && onAdd}
    <div class="text-right">
      <AddButton onclick={onAdd} />
    </div>
  {/if}
</div>
