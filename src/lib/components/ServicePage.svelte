<script lang="ts">
  import LayoutRenderer from './LayoutRenderer.svelte'
  import SchemaObject from './SchemaObject.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { def_get, schema_at, title_for } from '../schema.js'
  import { store, service_enabled, service_enable, service_disable } from '../store.svelte.js'
  import { servicesLayout } from '../layouts.js'
  import { SERVICE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    serviceKey: string
    changes?: ChangeEntry[]
    // The device build shows the services the device runs; only the standalone
    // editor decides which ones a document declares.
    toggleable?: boolean
  }

  let { serviceKey, changes = [], toggleable = false }: Props = $props()

  const enabled = $derived(service_enabled(serviceKey))

  function toggle() {
    if (enabled) service_disable(serviceKey)
    else service_enable(serviceKey)
  }

  const schema = $derived(schema_at(def_get('service') ?? {}, serviceKey))
  const node = $derived(servicesLayout.find((n) => n.objectSection === serviceKey))

  const data = $derived((store.doc.services as Record<string, Record<string, unknown> | undefined> | undefined)?.[serviceKey])

  // The owner writes: a child mutating a prop it does not own is what Svelte
  // reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }
</script>

<PageHeader title={title_for(serviceKey)}>
  {#snippet actions()}
    <ChangesIndicator {changes} scope="service:{serviceKey}" />
  {/snippet}
</PageHeader>

{#if toggleable}
  <div class="mb-5 flex items-center justify-end gap-2">
    <span class="text-xs font-medium text-zinc-700">{enabled ? t('Enabled') : t('Disabled')}</span>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t('Enable {name}', { name: title_for(serviceKey) })}
      onclick={toggle}
      class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition {enabled ? 'bg-accent' : 'bg-zinc-300'}"
    >
      <span class="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition {enabled ? 'translate-x-4' : 'translate-x-0.5'}"></span>
    </button>
  </div>
{/if}

{#if SERVICE_DESCRIPTIONS[serviceKey]}
  <p class="page-description">{t(SERVICE_DESCRIPTIONS[serviceKey])}</p>
{/if}

{#if toggleable && !enabled}
  <p class="rounded-base bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
    {t('This service is not enabled.')}
  </p>
{:else if data}
  {#if node?.children}
    <LayoutRenderer {data} {schema} layout={node.children} />
  {:else}
    <SchemaObject obj={data} onset={(k, v) => field_set(data, k, v)} {schema} />
  {/if}
{:else}
  <p class="text-sm text-zinc-500">{t('No configuration available for this service.')}</p>
{/if}
