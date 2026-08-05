<script lang="ts">
  import ListBox from './ListBox.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import { t } from '../i18n.svelte.js'

  interface Props {
    obj: Record<string, unknown>
    key: string
    options: string[]
    label?: string | null
  }

  let { obj, key, options, label = null }: Props = $props()

  const list = $derived(Array.isArray(obj[key]) ? (obj[key] as string[]) : [])
  const available = $derived(options.filter((o) => !list.includes(o)))

  let showModal = $state(false)
  let sel = $state('')

  function open() {
    sel = available[0] ?? ''
    showModal = true
  }
  function commit() {
    if (!sel) return
    if (!Array.isArray(obj[key])) obj[key] = []
    ;(obj[key] as string[]).push(sel)
    showModal = false
  }
  function remove(v: string) {
    const arr = obj[key] as string[]
    arr.splice(arr.indexOf(v), 1)
    if (!arr.length) delete obj[key]
  }
</script>

<ListBox items={list} {label} showAdd={available.length > 0} onAdd={open}>
  {#snippet row(v: string)}
    <span class="flex-1 font-mono text-xs font-semibold text-zinc-800">{v}</span>
    <RemoveButton onclick={() => remove(v)} />
  {/snippet}
</ListBox>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-xs rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-3 text-sm font-semibold">{t('Add')}</h3>
      <select class="input" bind:value={sel}>
        {#each available as o}
          <option value={o}>{t(o)}</option>
        {/each}
      </select>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
        <button type="button" class="btn-sm" onclick={commit}>{t('Add')}</button>
      </div>
    </div>
  </div>
{/if}
