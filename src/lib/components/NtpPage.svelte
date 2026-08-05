<script lang="ts">
  import ArrayListField from './ArrayListField.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { rootSchema, schema_at } from '../schema.js'
  import { store } from '../store.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes?: ChangeEntry[]
  }

  let { changes = [] }: Props = $props()

  const schema = schema_at(rootSchema, 'definitions.ntp-servers')

  $effect(() => {
    if (!store.doc.definitions || typeof store.doc.definitions !== 'object') store.doc.definitions = {}
  })

  const servers = $derived(store.doc.definitions?.['ntp-servers'] ?? [])

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<PageHeader title={t('NTP Servers')}>
  {#snippet actions()}
    <ChangesIndicator {changes} scope="ntp" />
  {/snippet}
</PageHeader>

<p class="page-description">{t(PAGE_DESCRIPTIONS.ntp)}</p>

{#if store.doc.definitions}
  <ArrayListField
    obj={store.doc.definitions as Record<string, unknown>}
    onset={(k, v) => field_set(store.doc.definitions as Record<string, unknown>, k, v)}
    key="ntp-servers"
    {schema}
    label="NTP Server"
    describe="Upstream NTP servers to synchronise the device clock against."
  />

  {#if !servers.length}
    <p class="mt-4 rounded-base bg-zinc-50 px-5 py-4 text-center text-sm text-zinc-500">
      {t('No NTP servers configured, the default NTP pool will be used')}
    </p>
  {/if}
{/if}
