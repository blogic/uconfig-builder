<script lang="ts">
  import CollapsibleSection from './CollapsibleSection.svelte'
  import ListBox from './ListBox.svelte'
  import RemoveButton from './RemoveButton.svelte'
  import { port_cover, effective_tag, port_options, port_absorbed, is_wildcard } from '../ports.js'
  import { device_ports } from '../capabilities.svelte.js'
  import { confirm } from '../confirm.svelte.js'
  import { iface_enabled, vlan_id } from '../interfaces.js'
  import { t } from '../i18n.svelte.js'
  import type { Interface, InterfacePorts } from '../types/uconfig'

  interface Props {
    iface: Interface
    interfaces: Record<string, Interface>
    selfName: string
    role: string | undefined
  }

  let { iface, interfaces, selfName, role }: Props = $props()

  const ports = $derived(iface.ports ?? {})
  const assigned = $derived(Object.keys(ports))
  const hasVlan = $derived(vlan_id(iface) != null)
  const portList = $derived(device_ports())

  let showModal = $state(false)
  let selPort = $state('')
  let selMode = $state<InterfacePorts>('auto')

  const selfCovered = $derived(new Set(assigned.flatMap((k) => port_cover(k, portList))))

  function others_cover(p: string): string[] {
    const tags: string[] = []
    for (const [n, iv] of Object.entries(interfaces)) {
      // A disabled interface is dropped by the device, so it holds no ports.
      if (n === selfName || !iface_enabled(iv)) continue
      const ivVlan = vlan_id(iv) != null
      for (const k of Object.keys(iv?.ports ?? {})) {
        if (port_cover(k, portList).includes(p)) tags.push(effective_tag(iv.ports![k], iv.role, ivVlan))
      }
    }
    return tags
  }
  function taken_untagged(p: string): boolean {
    return others_cover(p).includes('un-tagged')
  }
  function used_elsewhere(p: string): boolean {
    return others_cover(p).length > 0
  }

  // A physical port is free when nothing else holds it in a conflicting way.
  function port_free(p: string): boolean {
    return hasVlan ? !taken_untagged(p) : !used_elsewhere(p)
  }

  // Wildcards ignore self-coverage: holding lan1 must not stop the user
  // widening the assignment to lan*, which then absorbs it. They do require
  // every port they cover to be free of *other* interfaces.
  const availablePorts = $derived(
    port_options(portList).filter((key) => {
      const covered = port_cover(key, portList)
      if (!covered.length) return false
      if (is_wildcard(key)) {
        if (assigned.includes(key)) return false
        return covered.every(port_free)
      }
      if (selfCovered.has(key)) return false
      return port_free(key)
    })
  )

  const error = $derived(validate(selPort, selMode))

  function validate(port: string, mode: InterfacePorts): string {
    if (!port) return t('Select a port')
    if (!hasVlan) return ''
    const e = effective_tag(mode, role, true)
    // Wildcards stand or fall on the ports they cover.
    for (const p of port_cover(port, portList)) {
      if (e === 'un-tagged' && used_elsewhere(p))
        return t('{port} is used by another interface; it can only be shared when tagged', { port: p })
      if (e === 'tagged' && taken_untagged(p)) return t('{port} is used untagged by another interface', { port: p })
    }
    return ''
  }

  function open() {
    selPort = availablePorts[0] ?? ''
    selMode = 'auto'
    showModal = true
  }

  function commit() {
    if (error) return
    if (!iface.ports || typeof iface.ports !== 'object') iface.ports = {}
    // A wildcard already covers the discrete ports it subsumes; leaving those
    // behind would be a contradiction in the document.
    for (const k of port_absorbed(selPort, Object.keys(iface.ports), portList)) delete iface.ports[k]
    iface.ports[selPort] = hasVlan ? selMode : 'auto'
    showModal = false
  }

  async function remove(port: string) {
    if (!(await confirm(t('Remove port "{port}"?', { port })))) return
    delete iface.ports![port]
    if (!Object.keys(iface.ports!).length) delete iface.ports
  }
</script>

<CollapsibleSection title={t('Ports')}>
  {#snippet children()}
    <ListBox items={assigned} showAdd={availablePorts.length > 0} onAdd={open}>
      {#snippet row(item: unknown)}
        {@const port = item as string}
        <span class="flex-1 text-xs">
          <span class="font-mono font-semibold text-zinc-800">{port}</span>
          <span class="text-zinc-500"> — {t(effective_tag(ports[port], role, hasVlan))}</span>
        </span>
        <RemoveButton onclick={() => remove(port)} />
      {/snippet}
    </ListBox>
  {/snippet}
</CollapsibleSection>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-xs rounded-base border border-zinc-200 bg-surface p-4 shadow-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-3 text-sm font-semibold">{t('Add port')}</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="port-sel" class="text-xs font-medium text-zinc-700">{t('Port')}</label>
          <select id="port-sel" class="input" bind:value={selPort}>
            {#each availablePorts as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </div>
        {#if hasVlan}
          <div class="flex flex-col gap-1">
            <label for="port-mode" class="text-xs font-medium text-zinc-700">{t('Tagging')}</label>
            <select id="port-mode" class="input" bind:value={selMode}>
              <option value="auto">{t('auto')} ({t(effective_tag('auto', role, true))})</option>
              <option value="tagged">{t('tagged')}</option>
              <option value="un-tagged">{t('un-tagged')}</option>
            </select>
          </div>
        {/if}
        {#if error}
          <p class="text-[11px] text-amber-600">{error}</p>
        {/if}
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-sm" onclick={() => (showModal = false)}>{t('Cancel')}</button>
        <button type="button" class="btn-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={!!error} onclick={commit}>
          {t('Add')}
        </button>
      </div>
    </div>
  </div>
{/if}
