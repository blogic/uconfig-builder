<script lang="ts" generics="V extends Record<string, unknown> | string">
  import Field from './Field.svelte'
  import { title_for } from '../schema.js'
  import { confirm } from '../confirm.svelte.js'
  import { t } from '../i18n.svelte.js'
  import AddButton from './AddButton.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import type { Snippet } from 'svelte'
  import type { JsonSchemaNode } from '../schema'

  type MapEntry = Record<string, unknown>

  interface AddModalArg {
    create: (name: string, value: MapEntry) => void
    close: () => void
    map: Record<string, MapEntry>
  }

  interface Props {
    parent: Record<string, unknown>
    mapKey: string
    valueSchema: JsonSchemaNode | null
    keyLabel?: string
    tabbed?: boolean
    keyOptions?: string[] | null
    renamable?: boolean
    embedded?: boolean
    addModal?: Snippet<[AddModalArg]> | null
    makeValue?: ((name: string) => V) | null
    item?: Snippet<[V, string]> | null
    locked?: boolean
  }

  let {
    parent,
    mapKey,
    valueSchema,
    keyLabel = 'name',
    tabbed = false,
    keyOptions = null,
    renamable = true,
    embedded = false,
    addModal = null,
    makeValue = null,
    item = null,
    locked = false
  }: Props = $props()

  const map = $derived((parent[mapKey] as Record<string, V> | undefined) ?? {})
  const keys = $derived(Object.keys(map))
  const scalarValue = $derived(valueSchema && valueSchema.type && valueSchema.type !== 'object')
  const staticName = $derived(keyOptions != null || !renamable)

  let newKey = $state('')
  let showModal = $state(false)
  let active: string | null = $state(null)

  const available = $derived(keyOptions ? keyOptions.filter((o) => !keys.includes(o)) : null)

  $effect(() => {
    if (!keys.includes(active ?? '')) active = keys[0] ?? null
  })

  function ensure() {
    if (!parent[mapKey] || typeof parent[mapKey] !== 'object') parent[mapKey] = {}
  }

  function new_value(name: string): V {
    if (makeValue) return makeValue(name)
    // Without a makeValue factory the caller is using the built-in shape, which
    // is an empty string for scalar maps and an empty object otherwise; neither
    // is expressible as an arbitrary V.
    return (scalarValue ? '' : {}) as V
  }

  function add() {
    const name = newKey.trim()
    if (!name) return
    ensure()
    const m = parent[mapKey] as Record<string, V>
    if (m[name] === undefined) m[name] = new_value(name)
    active = name
    newKey = ''
  }

  function add_named(name: string) {
    ensure()
    const m = parent[mapKey] as Record<string, V>
    if (m[name] === undefined) m[name] = new_value(name)
    active = name
    showModal = false
  }

  function create(name: string, value: MapEntry) {
    ensure()
    const m = parent[mapKey] as Record<string, V>
    // addModal builds plain entry objects; only object-valued maps use it.
    if (m[name] === undefined) m[name] = value as V
    active = name
    showModal = false
  }

  async function remove(name: string) {
    const shown = keyOptions ? title_for(name) : name
    if (!(await confirm(t('Remove {label} "{name}"?', { label: t(keyLabel), name: shown })))) return
    delete (parent[mapKey] as Record<string, V>)[name]
  }

  function rename(oldName: string, e: Event) {
    const next = (e.currentTarget as HTMLInputElement).value.trim()
    if (!next || next === oldName) return
    const m = parent[mapKey] as Record<string, V>
    if (m[next] !== undefined) return
    const rebuilt: Record<string, V> = {}
    for (const [k, v] of Object.entries(m)) rebuilt[k === oldName ? next : k] = v
    parent[mapKey] = rebuilt
    if (active === oldName) active = next
  }
</script>

{#snippet body(name: string)}
  {#if scalarValue}
    <Field obj={map as Record<string, string>} key={name} schema={valueSchema ?? {}} label="value" />
  {:else if item}
    {@render item(map[name], name)}
  {/if}
{/snippet}

{#snippet rename_input(name: string)}
  <input
    class="input max-w-[16rem] font-mono text-xs"
    value={name}
    aria-label={t('{label} key', { label: t(keyLabel) })}
    onchange={(e) => rename(name, e)}
  />
{/snippet}

{#snippet name_or_rename(name: string)}
  {#if staticName}
    <span class="font-mono text-xs font-semibold text-zinc-700">{name}</span>
  {:else}
    {@render rename_input(name)}
  {/if}
{/snippet}

{#snippet add_control(narrow: boolean)}
  {#if locked}
    <!-- entries are fixed (device-driven); no manual add -->
  {:else if keyOptions}
    {#if available?.length}
      <AddButton label={t(keyLabel)} onclick={() => (showModal = true)} />
    {/if}
  {:else if addModal}
    <AddButton label={t(keyLabel)} onclick={() => (showModal = true)} />
  {:else}
    <input
      class="input {narrow ? 'max-w-[10rem]' : 'max-w-[16rem]'}"
      placeholder={t('new {label}…', { label: t(keyLabel) })}
      bind:value={newKey}
      onkeydown={(e) => e.key === 'Enter' && add()}
    />
    <AddButton label={t(keyLabel)} onclick={add} />
  {/if}
{/snippet}

{#if tabbed}
  <div class="flex flex-col gap-3">
    <div class="tab-row">
      {#each keys as name (name)}
        <button
          type="button"
          class="tab-button {active === name ? 'tab-button-active' : ''}"
          onclick={() => (active = name)}
        >
          {keyOptions ? title_for(name) : name}
        </button>
      {/each}
      {#if !keys.length}
        <span class="py-3 text-xs text-zinc-500">{t('No {label} yet.', { label: title_for(mapKey).toLowerCase() })}</span>
      {/if}
      <span class="flex-1"></span>
      {@render add_control(true)}
    </div>

    {#if active != null}
      {#if !staticName}
        <div class="mb-4">{@render rename_input(active)}</div>
      {/if}
      {@render body(active)}
      {#if !locked}
        <div class="mt-6 flex justify-end">
          <RemoveButton label={t(keyLabel)} onclick={() => active != null && remove(active)} />
        </div>
      {/if}
    {/if}
  </div>
{:else if embedded}
  <div class="flex flex-col gap-3">
    {#each keys as name (name)}
      <div class="flex flex-col gap-3 border-b border-zinc-100 pb-3">
        <div class="flex items-center gap-2">
          {@render name_or_rename(name)}
          <span class="flex-1"></span>
          {#if !locked}<RemoveButton label={t(keyLabel)} onclick={() => remove(name)} />{/if}
        </div>
        {@render body(name)}
      </div>
    {/each}
    <div class="flex items-center justify-end gap-2">{@render add_control(false)}</div>
  </div>
{:else}
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <span class="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title_for(mapKey)}
      </span>
    </div>
    {#each keys as name (name)}
      <div class="rounded-base border border-zinc-200 bg-surface">
        <div class="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
          {@render name_or_rename(name)}
          <span class="flex-1"></span>
          {#if !locked}<RemoveButton label={t(keyLabel)} onclick={() => remove(name)} />{/if}
        </div>
        <div class="px-3 py-3">{@render body(name)}</div>
      </div>
    {/each}
    <div class="flex items-center justify-end gap-2">{@render add_control(false)}</div>
  </div>
{/if}

{#if showModal && keyOptions && available}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-xs rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-3 text-sm font-semibold">{t('Add {label}', { label: t(keyLabel) })}</h3>
      <div class="flex flex-col gap-2">
        {#each available as opt}
          <button type="button" class="btn justify-center" onclick={() => add_named(opt)}>{title_for(opt)}</button>
        {/each}
      </div>
      <div class="mt-3 text-right">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
      </div>
    </div>
  </div>
{/if}

{#if showModal && addModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-sm rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      {@render addModal({ create, close: () => (showModal = false), map: map as Record<string, MapEntry> })}
    </div>
  </div>
{/if}
