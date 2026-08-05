<script lang="ts">
  import { default_width } from '../channels.js'
  import { band_widths } from '../capabilities.svelte.js'
  import { t } from '../i18n.svelte.js'
  import type { Radio } from '../types/uconfig'
  import type { JsonSchemaNode } from '../schema'

  interface Props {
    obj: Record<string, unknown>
    schema?: JsonSchemaNode
    band: string
    describe?: string | null
  }

  // `schema` kept in Props for the widget call-site contract; unused here.
  let { obj, schema: _schema, band, describe = null }: Props = $props()

  // Reads go through a narrowed view; the prop itself stays the caller's
  // object so mutations keep Svelte's ownership link.
  const o = $derived(obj as Radio)

  const fid = $props.id()
  const is5G = $derived(String(band).toUpperCase() === '5G')
  const value = $derived(o['channel-width'])
  // 160 MHz requires DFS, so hide it on 5G when DFS is explicitly disabled.
  const dfsOff = $derived(is5G && o['allow-dfs'] === false)
  const options = $derived(dfsOff ? band_widths(band).filter((w) => w !== 160) : band_widths(band))
  const invalid = $derived(value != null && !options.includes(value))
  const shown = $derived(invalid ? [value, ...options] : options)
  const desc = $derived(t((describe ?? '').replace(/\s+/g, ' ').trim()))

  $effect(() => {
    if (obj['channel-width'] == null) obj['channel-width'] = default_width(band) as Radio['channel-width']
    if (is5G && obj['channel-width'] === 160) obj['allow-dfs'] = true
  })

  function onChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (v === '') delete obj['channel-width']
    else obj['channel-width'] = Number(v) as Radio['channel-width']
  }
</script>

<div class="flex flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('Channel Width')}</label>
  <select id={fid} class="input" value={value ?? ''} onchange={onChange}>
    {#each shown as w}
      <option value={w}>{w} MHz</option>
    {/each}
  </select>
  {#if invalid}
    <p class="text-[11px] leading-snug text-amber-600">
      {value} MHz is not valid for {band}.
    </p>
  {/if}
  {#if desc}
    <p class="text-[11px] leading-snug text-zinc-500">{desc}</p>
  {/if}
</div>
