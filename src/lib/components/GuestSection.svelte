<script lang="ts">
  // The guest network as one decision.
  //
  // Guest is a whole interface, not just an SSID: its own VLAN, its own subnet,
  // and barred from the networks upstream of it. Turning it on writes all of
  // that; turning it off removes the interface entirely. The shape matches what
  // the setup wizard produces, so a network created here and one created there
  // are the same network.
  import LayoutRenderer from './LayoutRenderer.svelte'
  import { t } from '../i18n.svelte.js'
  import { store } from '../store.svelte.js'
  import { def_get } from '../schema.js'
  import { GUEST_VLAN, GUEST_SUBNET, radio_bands } from '../wizard.svelte.js'
  import { capabilities } from '../capabilities.svelte.js'
  import { GUEST_VLAN_KEY, include_ensure, overlay_get, overlay_set, ref_attach } from '../includes.js'
  import { iface_enabled } from '../interfaces.js'
  import { wirelessLayout } from '../layouts.js'

  const ssidDef = def_get('interface.ssid')

  const interfaces = $derived((store.doc.interfaces ?? {}) as Record<string, Record<string, unknown>>)
  const guest = $derived(interfaces.guest)
  const on = $derived(iface_enabled(guest))

  // An access point bridges guest traffic onto the VLAN; only a router owns the
  // subnet and answers DHCP on it. Which one this device is follows from
  // whether it has a downstream interface at all.
  const isRouter = $derived(
    Object.values(interfaces).some((i) => i?.role === 'downstream' && i !== guest && iface_enabled(i))
  )

  const vlan = $derived((overlay_get(GUEST_VLAN_KEY)?.id as number | undefined) ?? GUEST_VLAN)

  // The VLAN is the one part of a guest network that has to match across the
  // venue, so it lives in the shared include and the interface only points at
  // it. Seeded rather than overwritten: a venue that already agreed on an id
  // keeps it.
  function vlan_ref(): Record<string, unknown> {
    include_ensure()
    if (!overlay_get(GUEST_VLAN_KEY)) overlay_set(GUEST_VLAN_KEY, { id: GUEST_VLAN })
    const ref: Record<string, unknown> = {}
    ref_attach(ref, GUEST_VLAN_KEY)
    return ref
  }

  function guest_create() {
    const bands = radio_bands($state.snapshot(capabilities.data))
    const ssids = {
      guest: {
        ssid: '',
        'wifi-radios': bands,
        template: { mode: 'encrypted', security: 'maximum', key: '' }
      }
    }

    interfaces.guest = isRouter
      ? {
          role: 'downstream',
          ports: { 'lan*': 'auto' },
          vlan: vlan_ref(),
          ipv4: {
            addressing: 'static',
            subnet: GUEST_SUBNET,
            'dhcp-pool': { 'lease-first': 10, 'lease-count': 100, 'lease-time': '6h' },
            'disallow-upstream-subnet': true
          },
          ssids
        }
      : {
          role: 'upstream',
          ports: { 'wan*': 'auto', 'lan*': 'auto' },
          vlan: vlan_ref(),
          ipv4: { addressing: 'none' },
          ssids
        }
  }

  // Switched off rather than removed. Deleting the interface would leave a
  // router still carrying the guest VLAN on the wire once the SSID went away;
  // uconfig drops a disabled interface whole, and the settings survive for
  // whenever it comes back.
  function toggle() {
    if (!guest) return guest_create()
    if (on) guest.disable = true
    else delete guest.disable
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-3">
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t('Guest network')}
      onclick={toggle}
      class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition {on
        ? 'bg-accent'
        : 'bg-zinc-300'}"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition {on
          ? 'translate-x-4'
          : 'translate-x-0.5'}"
      ></span>
    </button>
    <span class="text-sm font-semibold text-zinc-900">{t('Guest network')}</span>
  </div>

  {#if on && guest?.ssids}
    <LayoutRenderer
      data={(guest.ssids as Record<string, Record<string, unknown>>).guest}
      schema={ssidDef ?? {}}
      layout={wirelessLayout}
      context={{ radios: store.doc.radios }}
    />

    {#if !isRouter}
      <p class="text-[11px] leading-snug text-zinc-500">
        {t('Guest traffic is bridged onto VLAN {id}. The router that owns the subnet answers DHCP for it.', {
          id: vlan
        })}
      </p>
    {/if}
  {/if}
</div>
