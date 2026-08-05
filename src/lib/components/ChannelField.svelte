<script lang="ts">
  import { channel_options, default_width } from '../channels.js'
  import { t } from '../i18n.svelte.js'
  import type { Radio } from '../types/uconfig'
  import type { JsonSchemaNode } from '../schema'

  interface Props {
    obj: Radio
    schema: JsonSchemaNode
    band: string
    describe?: string | null
  }

  // `schema` kept in Props for the widget call-site contract; unused here.
  let { obj, schema: _schema, band, describe = null }: Props = $props()

  const fid = $props.id()
  const desc = $derived(t(describe ?? ''))
  const value = $derived(obj.channel)
  const width = $derived(obj['channel-width'] ?? default_width(band))
  const options = $derived(channel_options(band, width))

  // Persist the displayed value: ACS when unset, and re-ACS when a width change
  // makes the selected channel invalid.
  $effect(() => {
    if (value == null) obj.channel = 'auto'
    else if (value !== 'auto' && !options.includes(value)) obj.channel = 'auto'
  })

  function onChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    obj.channel = v === 'auto' ? 'auto' : Number(v)
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
