<script>
  import LayoutRenderer from './LayoutRenderer.svelte'
  import SchemaObject from './SchemaObject.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { def_get, schema_at, title_for } from '../schema.js'
  import { store } from '../store.svelte.js'
  import { servicesLayout } from '../layouts.js'
  import { SERVICE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'

  let { serviceKey, changes = [] } = $props()

  const schema = $derived(schema_at(def_get('service'), serviceKey))
  const node = $derived(servicesLayout.find((n) => n.objectSection === serviceKey))

  $effect(() => {
    if (!store.doc.services || typeof store.doc.services !== 'object') store.doc.services = {}
    if (store.doc.services[serviceKey] == null) store.doc.services[serviceKey] = {}
  })

  const data = $derived(store.doc.services?.[serviceKey])
</script>

<div class="page-header">
  <h2 class="page-title">{title_for(serviceKey)}</h2>
  <ChangesIndicator {changes} scope="service:{serviceKey}" />
</div>

{#if SERVICE_DESCRIPTIONS[serviceKey]}
  <p class="page-description">{t(SERVICE_DESCRIPTIONS[serviceKey])}</p>
{/if}

{#if data}
  {#if node?.children}
    <LayoutRenderer {data} {schema} layout={node.children} />
  {:else}
    <SchemaObject obj={data} {schema} />
  {/if}
{:else}
  <p class="text-sm text-zinc-500">{t('No configuration available for this service.')}</p>
{/if}
