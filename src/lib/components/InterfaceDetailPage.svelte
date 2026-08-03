<script>
  import LayoutRenderer from './LayoutRenderer.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { def_get } from '../schema.js'
  import { store } from '../store.svelte.js'
  import { interfaceLayout } from '../layouts.js'
  import { confirm } from '../confirm.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'

  let { name, onBack, changes = [] } = $props()

  const interfaceDef = def_get('interface')
  const iface = $derived(store.doc.interfaces?.[name])

  async function remove() {
    if (!(await confirm(t('Remove interface "{name}"?', { name })))) return
    delete store.doc.interfaces[name]
    onBack()
  }
</script>

<div class="page-header">
  <button type="button" class="flex items-center text-accent transition hover:opacity-80" aria-label={t('Back')} onclick={onBack}>
    <i class="bi bi-arrow-left text-2xl"></i>
  </button>
  <h2 class="page-title">{t('Interface Configuration')}</h2>
  <ChangesIndicator {changes} scope="interfaces" />
</div>

{#if iface}
  <p class="page-description">{t(PAGE_DESCRIPTIONS.interface)}</p>

  <div class="mb-5 rounded-base bg-zinc-50 px-5 py-4 text-sm">
    <p><span class="font-semibold italic text-zinc-900">{t('Interface Name')}:</span> <span class="italic text-zinc-500">{name}</span></p>
    <p><span class="font-semibold italic text-zinc-900">{t('Role')}:</span> <span class="italic text-zinc-500">{iface.role ?? '—'}</span></p>
  </div>

  <LayoutRenderer
    data={iface}
    schema={interfaceDef}
    layout={interfaceLayout}
    context={{ role: iface.role, allInterfaces: store.doc.interfaces, selfName: name, radios: store.doc.radios }}
  />

  <div class="mt-6 flex justify-end">
    <button type="button" class="btn-sm-danger inline-flex items-center gap-1.5 px-3 py-2 text-sm" onclick={remove}>
      <i class="bi bi-trash"></i>
      {t('Remove Interface')}
    </button>
  </div>
{:else}
  <p class="text-sm text-zinc-500">{t('This interface no longer exists.')}</p>
{/if}
