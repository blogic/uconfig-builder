<script lang="ts">
  // The device's clock: the zone it reads in, and where it gets the time from.
  //
  // Both belong together even though the document keeps them apart, in
  // `unit.timezone` and `definitions.ntp-servers`. Nobody sets one thinking
  // about the other's part of the schema.
  import ArrayListField from './ArrayListField.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import PageHeader from './PageHeader.svelte'
  import TimezoneField from './TimezoneField.svelte'
  import { rootSchema, schema_at } from '../schema.js'
  import { store } from '../store.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes?: ChangeEntry[]
  }

  let { changes = [] }: Props = $props()

  const schema = schema_at(rootSchema, 'definitions.ntp-servers')

  $effect(() => {
    if (!store.doc.definitions || typeof store.doc.definitions !== 'object') store.doc.definitions = {}
    if (!store.doc.unit || typeof store.doc.unit !== 'object') store.doc.unit = {}
  })

  const servers = $derived(store.doc.definitions?.['ntp-servers'] ?? [])

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<PageHeader title={t('Time')}>
  {#snippet actions()}
    <ChangesIndicator {changes} scope="ntp" />
  {/snippet}
</PageHeader>

<p class="page-description">{t(PAGE_DESCRIPTIONS.time)}</p>

<div class="flex flex-col gap-5">
  {#if store.doc.unit}
    <TimezoneField
      obj={store.doc.unit as Record<string, unknown>}
      onset={(k, v) => field_set(store.doc.unit as Record<string, unknown>, k, v)}
    />
  {/if}

  {#if store.doc.definitions}
    <div>
      <ArrayListField
        obj={store.doc.definitions as Record<string, unknown>}
        onset={(k, v) => field_set(store.doc.definitions as Record<string, unknown>, k, v)}
        key="ntp-servers"
        {schema}
        label="NTP Server"
        describe="Upstream NTP servers to synchronise the device clock against."
      />

      {#if !servers.length}
        <p class="mt-2 max-w-sm text-[11px] leading-snug text-zinc-500">
          {t('No NTP servers configured, the default NTP pool will be used')}
        </p>
      {/if}
    </div>
  {/if}
</div>
