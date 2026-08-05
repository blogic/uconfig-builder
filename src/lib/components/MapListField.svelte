<script lang="ts">
  import SchemaObject from './SchemaObject.svelte'
  import ListBox from './ListBox.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import { title_for } from '../schema.js'
  import { confirm } from '../confirm.svelte.js'
  import { t } from '../i18n.svelte.js'
  import type { JsonSchemaNode } from '../schema'

  type MapEntry = Record<string, unknown>

  interface Props {
    container: Record<string, unknown>
    mapKey: string
    valueSchema: JsonSchemaNode | null
    keyLabel?: string
  }

  let { container, mapKey, valueSchema, keyLabel = 'entry' }: Props = $props()

  const map = $derived((container[mapKey] as Record<string, MapEntry> | undefined) ?? {})
  const keys = $derived(Object.keys(map))

  let showModal = $state(false)
  let name = $state('')
  let draft: MapEntry = $state({})

  const trimmed = $derived(name.trim())
  const nameError = $derived(
    !trimmed ? t('Name is required') : map[trimmed] !== undefined ? t('Name already in use') : ''
  )

  function open() {
    name = ''
    draft = {}
    showModal = true
  }

  function commit() {
    if (nameError) return
    if (!container[mapKey] || typeof container[mapKey] !== 'object') container[mapKey] = {}
    ;(container[mapKey] as Record<string, MapEntry>)[trimmed] = $state.snapshot(draft)
    showModal = false
  }

  async function remove(k: string) {
    if (!(await confirm(t('Remove {label} "{name}"?', { label: t(keyLabel), name: k })))) return
    const m = container[mapKey] as Record<string, MapEntry>
    delete m[k]
    if (!Object.keys(m).length) delete container[mapKey]
  }

  function summary(v: MapEntry): string {
    return Object.entries(v)
      .filter(([, x]) => x === null || typeof x !== 'object')
      .map(([, x]) => `${x}`)
      .join(' · ')
  }

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<ListBox items={keys} label={title_for(mapKey)} onAdd={open}>
  {#snippet row(k: string)}
    <span class="flex-1 text-xs">
      <span class="font-mono font-semibold text-zinc-800">{k}</span>
      {#if summary(map[k])}<span class="text-zinc-500"> — {summary(map[k])}</span>{/if}
    </span>
    <RemoveButton onclick={() => remove(k)} />
  {/snippet}
</ListBox>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    onclick={() => (showModal = false)}
  >
    <div
      class="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-base border border-zinc-200 bg-surface p-4 shadow-lg"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 class="mb-3 text-sm font-semibold">{t('Add {label}', { label: t(keyLabel) })}</h3>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="ml-name" class="text-xs font-medium text-zinc-700">{t('Name')}</label>
          <input id="ml-name" class="input" bind:value={name} />
          {#if trimmed && nameError}
            <p class="text-[11px] text-amber-600">{nameError}</p>
          {/if}
        </div>
        <SchemaObject obj={draft} onset={(k, v) => field_set(draft as Record<string, unknown>, k, v)} schema={valueSchema ?? {}} />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
        <button
          type="button"
          class="btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!!nameError}
          onclick={commit}
        >
          {t('Add')}
        </button>
      </div>
    </div>
  </div>
{/if}
