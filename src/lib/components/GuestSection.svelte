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
  import { wirelessLayout } from '../layouts.js'

  const ssidDef = def_get('interface.ssid')

  const interfaces = $derived((store.doc.interfaces ?? {}) as Record<string, Record<string, unknown>>)
  const guest = $derived(interfaces.guest)
  const on = $derived(guest != null)

  // An access point bridges guest traffic onto the VLAN; only a router owns the
  // subnet and answers DHCP on it. Which one this device is follows from
  // whether it has a downstream interface at all.
  const isRouter = $derived(Object.values(interfaces).some((i) => i?.role === 'downstream' && i !== guest))

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
          vlan: { id: GUEST_VLAN },
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
          vlan: { id: GUEST_VLAN },
          ipv4: { addressing: 'none' },
          ssids
        }
  }

  function toggle() {
    if (on) delete interfaces.guest
    else guest_create()
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
    {#if on}
      <span class="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
        {t('VLAN {id}', { id: GUEST_VLAN })}
      </span>
    {/if}
  </div>

  {#if on && guest?.ssids}
    <LayoutRenderer
      data={(guest.ssids as Record<string, Record<string, unknown>>).guest}
      schema={ssidDef ?? {}}
      layout={wirelessLayout}
      context={{ radios: store.doc.radios }}
    />

    {#if isRouter}
      <div class="flex flex-col gap-1">
        <span class="text-xs font-medium text-zinc-700">{t('Guest addresses')}</span>
        <input class="input bg-zinc-50 text-zinc-500" value={GUEST_SUBNET} readonly />
        <p class="text-[11px] leading-snug text-zinc-500">
          {t('This device owns the guest subnet and answers DHCP on it. Access points bridge onto the same VLAN.')}
        </p>
      </div>
    {:else}
      <p class="text-[11px] leading-snug text-zinc-500">
        {t('Guest traffic is bridged onto VLAN {id}. The router that owns the subnet answers DHCP for it.', {
          id: GUEST_VLAN
        })}
      </p>
    {/if}
  {/if}
</div>
