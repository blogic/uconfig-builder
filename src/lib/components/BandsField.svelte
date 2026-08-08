<script lang="ts">
  import { confirm } from '../confirm.svelte.js'
  import ListBox from './ListBox.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import { title_for } from '../schema.js'
  import { t } from '../i18n.svelte.js'
  import type { LayoutContext } from '../layouts'

  interface Props {
    // The owner of `obj` performs the write; a child mutating a prop it does
    // not own is what Svelte reports as ownership_invalid_mutation.
    onset: (key: string, value: unknown) => void
    obj: Record<string, unknown>
    context?: LayoutContext
  }

  let { obj, onset, context }: Props = $props()

  const KEY = 'wifi-radios'
  const list = $derived(Array.isArray(obj[KEY]) ? (obj[KEY] as string[]) : [])
  const allBands = $derived(Object.keys(context?.radios ?? {}))
  const available = $derived(allBands.filter((b) => !list.includes(b)))

  let showModal = $state(false)
  let sel = $state('')

  function open() {
    sel = available[0] ?? ''
    showModal = true
  }
  function commit() {
    if (!sel) return
    if (!Array.isArray(obj[KEY])) onset(KEY, [])
    ;(obj[KEY] as string[]).push(sel)
    showModal = false
  }
  async function remove(b: string) {
    if (!(await confirm(t('Remove radio "{name}"?', { name: title_for(b) })))) return
    const arr = obj[KEY] as string[]
    arr.splice(arr.indexOf(b), 1)
    if (!arr.length) onset(KEY, undefined)
  }
</script>

<ListBox items={list} label="WiFi Radios" showAdd={available.length > 0} onAdd={open}>
  {#snippet row(b: string)}
    <span class="flex-1 text-sm font-semibold text-zinc-800">{title_for(b)}</span>
    <RemoveButton onclick={() => remove(b)} />
  {/snippet}
</ListBox>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-xs rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-3 text-sm font-semibold">{t('Add radio')}</h3>
      <select class="input" bind:value={sel}>
        {#each available as b}
          <option value={b}>{title_for(b)}</option>
        {/each}
      </select>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
        <button type="button" class="btn-sm" onclick={commit}>{t('Add')}</button>
      </div>
    </div>
  </div>
{/if}
