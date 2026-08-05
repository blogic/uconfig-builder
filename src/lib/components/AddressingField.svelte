<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import type { JsonSchemaNode } from '../schema'

  interface Props {
    obj: Record<string, unknown>
    schema: JsonSchemaNode
    role?: string
    describe?: string | null
  }

  let { obj, schema, role, describe = null }: Props = $props()

  const fid = $props.id()
  const desc = $derived(t(describe ?? ''))
  const isDownstream = $derived(role === 'downstream')
  const options = $derived((schema.enum as string[] | undefined) ?? ['dynamic', 'static'])
  const addressing = $derived(obj.addressing as string | undefined)

  // Downstream interfaces are always static; upstream default to dynamic (DHCP).
  $effect(() => {
    if (isDownstream) {
      if (obj.addressing !== 'static') obj.addressing = 'static'
    } else if (obj.addressing == null) {
      obj.addressing = 'dynamic'
    }
  })

  function onChange(e: Event) {
    obj.addressing = (e.currentTarget as HTMLSelectElement).value
  }
</script>

{#if !isDownstream}
  <div class="flex flex-col gap-1">
    <label for={fid} class="text-xs font-medium text-zinc-700">{t('Addressing')}</label>
    <select id={fid} class="input" value={addressing ?? 'dynamic'} onchange={onChange}>
      {#each options as o}
        <option value={o}>{t(o)}</option>
      {/each}
    </select>
    {#if desc}<p class="text-[11px] leading-snug text-zinc-500">{desc}</p>{/if}
  </div>
{/if}
