<script lang="ts">
  import InterfaceAddForm from './InterfaceAddForm.svelte'
  import ChangesIndicator from './ChangesIndicator.svelte'
  import { store } from '../store.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'
  import type { Interface } from '../types/uconfig'

  interface Props {
    onOpen: (name: string) => void
    changes?: ChangeEntry[]
  }

  let { onOpen, changes = [] }: Props = $props()

  let showModal = $state(false)

  const interfaces = $derived(store.doc.interfaces ?? {})
  const names = $derived(Object.keys(interfaces))

  function create(name: string, value: Interface) {
    if (!store.doc.interfaces || typeof store.doc.interfaces !== 'object') store.doc.interfaces = {}
    if (store.doc.interfaces[name] === undefined) store.doc.interfaces[name] = value
    showModal = false
    onOpen(name)
  }

  function summary(iface: Interface | undefined) {
    const addressing = iface?.ipv4?.addressing ?? (iface?.role === 'downstream' ? 'static' : 'dynamic')
    const ports = Object.keys(iface?.ports ?? {}).join(', ')
    return { addressing, ports }
  }
</script>

<PageHeader title={t('Interfaces')}>
  {#snippet actions()}
    <ChangesIndicator {changes} scope="interfaces" />
    <button type="button" class="btn-primary rounded-base px-3 py-1.5 text-sm font-medium" onclick={() => (showModal = true)}>
      {t('Add Interface')}
    </button>
  {/snippet}
</PageHeader>

<p class="page-description">{t(PAGE_DESCRIPTIONS.interfaces)}</p>

{#if names.length}
  <div class="divide-y divide-zinc-200 rounded-base border border-zinc-200">
    {#each names as name (name)}
      {@const s = summary(interfaces[name])}
      <button type="button" class="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-zinc-50" onclick={() => onOpen(name)}>
        <span class="flex-1">
          <span class="block text-sm font-semibold text-zinc-900">{name}</span>
          <span class="block text-xs italic text-zinc-500">{t('Role')}: {interfaces[name]?.role ?? '—'}</span>
          <span class="block text-xs text-zinc-500">IPv4: {s.addressing} | {t('Ports')}: {s.ports}</span>
        </span>
        <i class="bi bi-arrow-right text-zinc-400"></i>
      </button>
    {/each}
  </div>
{:else}
  <p class="text-sm text-zinc-500">{t('No interfaces yet.')}</p>
{/if}

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-sm rounded-base border border-zinc-200 bg-surface p-4 shadow-flat-lg" onclick={(e) => e.stopPropagation()}>
      <InterfaceAddForm {interfaces} {create} close={() => (showModal = false)} />
    </div>
  </div>
{/if}
