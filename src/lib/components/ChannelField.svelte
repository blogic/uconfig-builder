<script lang="ts">
  import { channel_options, default_width } from '../channels.js'
  import { t } from '../i18n.svelte.js'
  import type { Radio } from '../types/uconfig'
  import type { JsonSchemaNode } from '../schema'

  interface Props {
    // The owner of `obj` performs the write; a child mutating a prop it does
    // not own is what Svelte reports as ownership_invalid_mutation.
    onset: (key: string, value: unknown) => void
    obj: Record<string, unknown>
    schema: JsonSchemaNode
    band: string
    describe?: string | null
  }

  // `schema` kept in Props for the widget call-site contract; unused here.
  let { obj, onset, schema: _schema, band, describe = null }: Props = $props()

  // Reads go through a narrowed view; the prop itself stays the caller's
  // object so mutations keep Svelte's ownership link.
  const o = $derived(obj as Radio)

  const fid = $props.id()
  const desc = $derived(t(describe ?? ''))
  const value = $derived(o.channel)
  const width = $derived(o['channel-width'] ?? default_width(band))
  const options = $derived(channel_options(band, width))

  // Persist the displayed value: ACS when unset, and re-ACS when a width change
  // makes the selected channel invalid.
  $effect(() => {
    if (value == null) onset('channel', 'auto')
    else if (value !== 'auto' && !options.includes(value)) onset('channel', 'auto')
  })

  function onChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    onset('channel', v === 'auto' ? 'auto' : Number(v))
  }
</script>

<div class="flex flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('Channel')}</label>
  <select id={fid} class="input" value={value ?? 'auto'} onchange={onChange}>
    <option value="auto">{t('Automatic')}</option>
    {#each options as ch}
      <option value={ch}>{ch}</option>
    {/each}
  </select>
  {#if desc}<p class="text-[11px] leading-snug text-zinc-500">{desc}</p>{/if}
</div>
