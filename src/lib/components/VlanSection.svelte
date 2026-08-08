<script lang="ts">
  import CollapsibleSection from './CollapsibleSection.svelte'
  import ListBox from './ListBox.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import { confirm } from '../confirm.svelte.js'
  import { iface_enabled, vlan_id, VLAN_MAX, VLAN_MIN } from '../interfaces.js'
  import { t } from '../i18n.svelte.js'
  import type { Interface } from '../types/uconfig'

  interface Props {
    iface: Interface
    interfaces: Record<string, Interface>
    selfName: string
    role: string | undefined
  }

  let { iface, interfaces, selfName, role }: Props = $props()

  const vlan = $derived(iface.vlan ?? {})
  const isUpstream = $derived(role === 'upstream')
  const trunks = $derived(Array.isArray(vlan.trunks) ? vlan.trunks : [])
  // May arrive through an include rather than sitting in the document.
  const id = $derived(vlan_id(iface))

  // VLAN ids that a downstream interface relies on; these trunks can't be removed.
  const consumed = $derived(downstream_vlans())
  function downstream_vlans(): Set<number> {
    const s = new Set<number>()
    for (const [n, iv] of Object.entries(interfaces)) {
      if (n === selfName || !iface_enabled(iv)) continue
      const iv_id = vlan_id(iv)
      if (iv?.role === 'downstream' && iv_id != null) s.add(iv_id)
    }
    return s
  }

  let showModal = $state(false)
  let entry = $state('')
  const val = $derived(Number(entry))
  const error = $derived(validate())

  function validate(): string {
    if (entry === '') return t('A VLAN ID is required')
    if (!Number.isInteger(val) || val < VLAN_MIN || val > VLAN_MAX) return t('VLAN ID must be 1 to 4094')
    if (val === id) return t('Cannot trunk the interface VLAN')
    if (trunks.includes(val)) return t('Already a trunk')
    return ''
  }

  function open() {
    entry = ''
    showModal = true
  }
  function commit() {
    if (error) return
    // An upstream may carry trunks without a VLAN of its own, so the first
    // trunk has to be able to create the section it lives in.
    if (!iface.vlan) iface.vlan = {}
    if (!Array.isArray(iface.vlan.trunks)) iface.vlan.trunks = []
    iface.vlan.trunks.push(val)
    showModal = false
  }
  async function remove(tr: number) {
    if (consumed.has(tr)) return
    if (!(await confirm(t('Remove trunk {id}?', { id: tr })))) return
    if (!iface.vlan?.trunks) return
    const i = iface.vlan.trunks.indexOf(tr)
    if (i >= 0) iface.vlan.trunks.splice(i, 1)
    if (!iface.vlan.trunks.length) delete iface.vlan.trunks
    // Drop the container too, rather than leaving `vlan: {}` in the document.
    // An include reference is a reason to keep it: the id lives in the fragment.
    const referenced = Array.isArray((iface.vlan as Record<string, unknown>).include)
    if (iface.vlan.id == null && !iface.vlan.trunks && !referenced) delete iface.vlan
  }
</script>

<CollapsibleSection title={t('VLAN')}>
  {#snippet children()}
    <div class="flex flex-col gap-4">
      {#if id != null}
        <div class="flex flex-col gap-1">
          <label for="vlan-id" class="text-xs font-medium text-zinc-700">{t('VLAN ID')}</label>
          <input id="vlan-id" class="input bg-zinc-100 text-zinc-600" value={id} readonly />
        </div>
      {/if}

      {#if isUpstream}
        <ListBox items={trunks} label="Trunks" onAdd={open}>
          {#snippet row(item: unknown)}
            {@const tr = item as number}
            <span class="flex-1 font-mono text-xs text-zinc-800">{tr}</span>
            {#if consumed.has(tr)}
              <span class="text-[11px] text-zinc-400">{t('in use downstream')}</span>
            {:else}
              <RemoveButton onclick={() => remove(tr)} />
            {/if}
          {/snippet}
        </ListBox>
      {/if}
    </div>
  {/snippet}
</CollapsibleSection>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-xs rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-3 text-sm font-semibold">{t('Add trunk')}</h3>
      <input class="input" type="number" min={VLAN_MIN} max={VLAN_MAX} bind:value={entry} placeholder={t('1 to 4094')} onkeydown={(e) => e.key === 'Enter' && commit()} />
      {#if entry !== '' && error}<p class="mt-1 text-[11px] text-amber-600">{error}</p>{/if}
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
        <button type="button" class="btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={!!error} onclick={commit}>{t('Add')}</button>
      </div>
    </div>
  </div>
{/if}
