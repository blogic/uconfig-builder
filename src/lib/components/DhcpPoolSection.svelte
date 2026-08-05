<script lang="ts">
  import CollapsibleSection from './CollapsibleSection.svelte'
  import Field from './Field.svelte'
  import LeasesField from './LeasesField.svelte'
  import { def_get, ref_resolve } from '../schema.js'
  import { t } from '../i18n.svelte.js'
  import { DESCRIPTIONS } from '../descriptions.js'
  import type { Interface1 } from '../types/uconfig'
  import type { JsonSchemaNode } from '../schema'

  type PoolFieldValue = string | number | boolean | (string | number)[] | undefined

  interface Props {
    ipv4: Interface1
  }

  let { ipv4 }: Props = $props()

  const poolDef = ref_resolve(def_get('interface.ipv4.dhcp-pool')!)
  const poolProps: Record<string, JsonSchemaNode> = poolDef.properties ?? {}

  // Downstream interfaces always have a DHCP pool.
  $effect(() => {
    if (ipv4['dhcp-pool'] == null) ipv4['dhcp-pool'] = {}
  })
</script>

<CollapsibleSection title={t('DHCP Pool')}>
  {#snippet children()}
    {@const pool = ipv4['dhcp-pool'] as Record<string, PoolFieldValue> | undefined}
    {#if pool}
      <div class="flex flex-col gap-4">
        <Field obj={pool} key="lease-first" schema={poolProps['lease-first'] ?? {}} describe={DESCRIPTIONS['lease-first']} />
        <Field obj={pool} key="lease-count" schema={poolProps['lease-count'] ?? {}} describe={DESCRIPTIONS['lease-count']} />
        <Field obj={pool} key="lease-time" schema={poolProps['lease-time'] ?? {}} describe={DESCRIPTIONS['lease-time']} />
        <LeasesField container={ipv4} subnet={ipv4.subnet} />
      </div>
    {/if}
  {/snippet}
</CollapsibleSection>
