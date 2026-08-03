<script>
  import ArrayListField from './ArrayListField.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { rootSchema, schema_at } from '../schema.js'
  import { store } from '../store.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'

  let { changes = [] } = $props()

  const schema = schema_at(rootSchema, 'definitions.ntp-servers')

  $effect(() => {
    if (!store.doc.definitions || typeof store.doc.definitions !== 'object') store.doc.definitions = {}
  })

  const servers = $derived(store.doc.definitions?.['ntp-servers'] ?? [])
</script>

<div class="page-header">
  <h2 class="page-title">{t('NTP Servers')}</h2>
  <ChangesIndicator {changes} scope="ntp" />
</div>

<p class="page-description">{t(PAGE_DESCRIPTIONS.ntp)}</p>

{#if store.doc.definitions}
  <ArrayListField
    obj={store.doc.definitions}
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
