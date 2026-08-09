<script lang="ts">
  import LayoutRenderer from './lib/components/LayoutRenderer.svelte'
  import MapEditor from './lib/components/MapEditor.svelte'
  import ConfirmModal from './lib/components/ConfirmModal.svelte'
  import ConfigurationPanel from './lib/components/ConfigurationPanel.svelte'
  import ChangesIndicator from './lib/components/ChangesIndicator.svelte'
  import GuestSection from './lib/components/GuestSection.svelte'
  import PageHeader from './lib/components/PageHeader.svelte'
  import ServicePage from './lib/components/ServicePage.svelte'
  import SystemServicePage from './lib/components/SystemServicePage.svelte'
  import JsonPage from './lib/components/JsonPage.svelte'
  import NtpPage from './lib/components/NtpPage.svelte'
  import TimePage from './lib/components/TimePage.svelte'
  import InterfaceAddForm from './lib/components/InterfaceAddForm.svelte'
  import BottomNav from './lib/components/BottomNav.svelte'
  import TopBar from './lib/components/TopBar.svelte'
  import SectionNav from './lib/components/SectionNav.svelte'
  import ServiceListPage from './lib/components/ServiceListPage.svelte'
  import Spinner from './lib/components/Spinner.svelte'
  import Button from './lib/components/Button.svelte'
  import BrandMark from './lib/components/BrandMark.svelte'
  import { def_get } from './lib/schema.js'
  import {
    SERVICE_ENTRIES,
    SECTIONS,
    STATUS_ITEMS,
    group_pages,
    items_for,
    sections_for,
    service_entries,
    system_service_entries
  } from './lib/nav.js'
  import { IS_DEVICE, IS_EDITOR } from './lib/flavour.js'
  import { iface_enabled } from './lib/interfaces.js'
  import { PAGE_DESCRIPTIONS } from './lib/descriptions.js'
  import { default_width } from './lib/channels.js'
  import {
    unitLayout,
    radioLayout,
    interfaceLayout,
    wirelessLayout,
    radioIntentLayout,
    wanLayout,
    lanLayout,
    guestLayout,
    primary_iface
  } from './lib/layouts.js'
  import { view } from './lib/view.svelte.js'
  import { route, route_parse, route_sync, route_clear } from './lib/router.svelte.js'
  import { hoisted } from './lib/page.svelte.js'
  import { confirm } from './lib/confirm.svelte.js'
  import { settings } from './lib/settings.svelte.js'
  import { accordion_provide } from './lib/accordion.svelte.js'
  import { changes_list, include_changes } from './lib/changes.js'
  import { t } from './lib/i18n.svelte.js'
  import {
    store,
    example_names,
    example_load,
    config_load,
    saved_names,
    doc_export,
    doc_adopt,
    doc_reset
  } from './lib/store.svelte.js'
  import type { ConfigPayload } from './lib/store.svelte.js'
  import { device_load, deviceApi } from './lib/device.svelte.js'
  import type { DeviceMod } from './lib/device.svelte.js'
  import type { Radio, Interface } from './lib/types/uconfig'
  import type { Route } from './lib/router.svelte.js'
  import type { CapabilitiesData } from './lib/capabilities.svelte.js'

  // Device modules load on demand; in the editor build the branch is dropped
  // and nothing below ever runs.
  let dev = $state<DeviceMod | null>(null)
  const connection = $derived(
    dev?.conn.connection ?? { status: 'idle' as const, lost: false, modules: null as string[] | null }
  )
  const capabilities = $derived(dev?.caps.capabilities ?? { data: null })

  async function device_ready(): Promise<DeviceMod | null> {
    if (!IS_DEVICE) return null
    if (!dev) dev = await device_load()
    return dev
  }

  function device_reset() {
    if (!dev) return
    dev.conn.disconnect()
    dev.caps.capabilities_clear()
    dev.devices.devices_clear()
    dev.sysinfo.sysinfo_clear()
    dev.traffic.traffic_clear()
    dev.system.system_clear()
    dev.poll.poll_clear()
  }

  const DP = $derived(deviceApi.pages)
  const loading = $derived(dev?.poll.loading ?? { active: false, done: 0, total: 1 })

  const preview = $derived(doc_export())

  const unitDef = def_get('unit')
  const radioDef = def_get('radio')
  const interfaceDef = def_get('interface')
  const ssidDef = def_get('interface.ssid')
  let openInterface = $state<string | null>(null)

  function radio_defaults(band: string): Record<string, unknown> {
    return { 'channel-mode': 'HE', 'channel-width': default_width(band) as Radio['channel-width'] }
  }

  // Top-level cards (cards view) act as a single accordion.
  accordion_provide()

  // The theme follows the operating system, and keeps following it: there is
  // no in-app switch, so a stored preference would be a setting nothing could
  // change back.
  const mql = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
  let systemDark = $state(mql?.matches ?? false)
  mql?.addEventListener?.('change', (e: MediaQueryListEvent) => (systemDark = e.matches))
  const themeMode = $derived(systemDark ? 'dark' : 'light')

  $effect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
    document.documentElement.style.colorScheme = themeMode
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', themeMode)
  })
  // Menu (sidebar) layout on desktop, stacked cards on mobile.
  const wideMql = globalThis.matchMedia?.('(min-width: 768px)')
  let wide = $state(wideMql?.matches ?? true)
  wideMql?.addEventListener?.('change', (e: MediaQueryListEvent) => (wide = e.matches))
  $effect(() => {
    view.mode = wide ? 'menu' : 'cards'
  })

  let screen = $state<'welcome' | 'login' | 'wizard' | 'app'>('welcome')
  let section = $state('config') // 'status' | 'config' | 'system'
  let deviceSession = $state(false) // logged into a device (survives idle disconnects)
  let welcomeExample = $state('')
  let welcomeSaved = $state('')
  let host = $state(settings.host ?? '')
  let password = $state('')
  let loginError = $state<string | null>(null)
  let loadWarning = $state<string | null>(null) // config-get failed, editing a blank document
  let connectionLost = $state(false) // session dropped; shown on the landing page
  let loggingIn = $state(false)
  let connState = $state<'idle' | 'connecting' | 'ready' | 'error'>('idle')

  // A connected device reports which optional packages it has; without one the
  // whole set is offered, which is what the offline editor wants.
  const serviceEntries = $derived(
    deviceSession ? service_entries(connection.modules ?? null) : SERVICE_ENTRIES
  )

  // Children of every expandable nav group, by the group item's key.
  const navGroups = $derived({
    services: serviceEntries,
    'system-services': system_service_entries(deviceSession ? (connection.modules ?? null) : null)
  })
  function start_default() {
    section = 'config'
    view.section = 'unit'
    example_load('default')
    screen = 'app'
  }
  function start_example() {
    if (!welcomeExample) return
    section = 'config'
    view.section = 'unit'
    example_load(welcomeExample)
    screen = 'app'
  }
  function start_saved() {
    if (!welcomeSaved) return
    section = 'config'
    view.section = 'unit'
    config_load(welcomeSaved)
    screen = 'app'
  }
  async function host_connect() {
    const h = host.trim()
    if (!h) return
    settings.host = h
    loginError = null
    connectionLost = false
    if (dev) dev.conn.connection.lost = false
    connState = 'connecting'
    screen = 'login'
    try {
      const d = await device_ready()
      if (!d) return
      await d.conn.connect(h)
      connState = 'ready'

      // An unconfigured device has no password yet, so it goes straight to the
      // wizard rather than asking for one.
      if (d.conn.connection.setupRequired) {
        try {
          d.caps.capabilities_set(await d.conn.request<CapabilitiesData>('capabilities', {}))
        } catch {
          /* radios fall back to defaults */
        }
        deviceSession = true
        screen = 'wizard'
      }
    } catch (e) {
      connState = 'error'
      loginError = e instanceof Error ? e.message : String(e)
    }
  }
  async function host_login(event: SubmitEvent) {
    event?.preventDefault()
    if (loggingIn) return
    if (!dev) return
    loginError = null
    loadWarning = null
    loggingIn = true
    try {
      await dev.conn.login(password)
      // Pull the device's active config; a fresh device may have none yet.
      try {
        doc_adopt(await dev.conn.request<ConfigPayload>('config-get', {}), settings.host ?? '')
      } catch (e) {
        loadWarning = e instanceof Error ? e.message : String(e)
      }
      try {
        dev.caps.capabilities_set(await dev.conn.request<CapabilitiesData>('capabilities', {}))
      } catch {
        /* device did not report capabilities; static defaults apply */
      }
      password = ''
      deviceSession = true

      // A device that has never been set up has no top-level `webui` object.
      // Its absence is the signal, so the wizard runs before the app proper.
      if (IS_DEVICE && (store.doc as Record<string, unknown>).webui === undefined) {
        screen = 'wizard'
        return
      }
      section = IS_DEVICE ? 'status' : 'config'
      // Taken from the nav rather than named here, so reordering a section's
      // items also moves the page a session lands on.
      view.section = IS_DEVICE ? (STATUS_ITEMS[0]?.key ?? 'traffic') : 'unit'

      // Seed every live page before leaving the login card, so the app appears
      // fully populated rather than filling in behind visible chrome.
      if (IS_DEVICE) await dev.poll.preload()
      screen = 'app'
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    } finally {
      loggingIn = false
    }
  }

  // The wizard has already applied the document and logged in, so this adopts
  // what the device is now running and opens the app on it.
  async function wizard_done(payload: ConfigPayload) {
    doc_adopt(payload, settings.host ?? '')
    section = 'status'
    view.section = STATUS_ITEMS[0]?.key ?? 'traffic'
    if (IS_DEVICE && dev) await dev.poll.preload()
    screen = 'app'
  }

  function login_back() {
    device_reset()
    loginError = null
    connState = 'idle'
    screen = 'welcome'
    route_clear()
  }

  async function logout() {
    if (!(await confirm(t('Log out of {host}?', { host: settings.host ?? '' }), t('Log out')))) return
    device_reset()
    doc_reset()
    loadWarning = null
    deviceSession = false
    screen = 'welcome'
    route_clear()
  }

  // A dropped session leaves a signed-in UI that cannot reach the device;
  // reset to the landing page and say why.
  $effect(() => {
    if (!connection.lost) return
    device_reset()
    doc_reset()
    deviceSession = false
    connState = 'idle'
    view.section = 'unit'
    loadWarning = null
    loginError = null
    screen = 'welcome'
    route_clear()
    connectionLost = true
  })

  // Keep the URL in step with the current page so back/forward work. Only the
  // routed screens are tracked; welcome and login are deliberately excluded.
  $effect(() => {
    if (screen !== 'app') return
    route_sync({ section: activeSection, page: view.section, openInterface })
  })

  function route_apply(r: Route | null) {
    if (!r) return
    // A route only makes sense once a session exists; ignore it otherwise.
    if (SECTIONS.find((s) => s.key === r.section)?.device && !deviceSession) return
    screen = 'app'
    if (r.section) section = r.section
    if (r.page) view.section = r.page
    openInterface = r.openInterface ?? null
  }

  $effect(() => {
    const on_pop = async () => {
      const r = route_parse(location.hash)
      if (r) {
        route.path = location.hash
        route_apply(r)
        return
      }
      // Backed out past the first page of the session. Offer to log out;
      // staying puts the entry we just left back on the stack.
      if (screen !== 'app') return
      if (!(await confirm(t('Log out and disconnect from the device?'), 'Log out'))) {
        history.pushState(null, '', route.path)
        return
      }
      logout()
    }
    globalThis.addEventListener('popstate', on_pop)
    return () => globalThis.removeEventListener('popstate', on_pop)
  })

  const savedConfigs = $derived(saved_names())
  // With device capabilities loaded we know the radios; lock manual add/remove.
  const radiosLocked = $derived(capabilities.data != null)
  const changes = $derived([
    ...changes_list(store.doc, store.baseline),
    ...include_changes(store.includes, store.includeBaselines, store.doc)
  ])

  // Sections available for this build and breakpoint. System and Configure are
  // desktop-only: reboot, firmware and schema editing are not phone errands.
  const availableSections = $derived(
    sections_for(IS_DEVICE, IS_EDITOR, wide, deviceSession, changes.length > 0)
  )
  const activeSection = $derived(
    availableSections.some((s) => s.key === section) ? section : (availableSections[0]?.key ?? 'config')
  )
  const sectionItems = $derived(
    items_for(availableSections.find((s) => s.key === activeSection)?.items ?? [], changes.length > 0, store.doc)
  )

  // Mobile has no section tabs, so the bottom bar spans them: the Status pages
  // plus the venue overview, which is a read-only view worth reaching there.
  const bottomItems = $derived(
    availableSections
      .filter((s) => s.key === 'status' || s.key === 'ucoord')
      .flatMap((s) =>
        s.key === 'ucoord' ? [{ ...s.items[0], label: s.label }] : s.items
      )
  )

  function bottom_select(key: string) {
    // Each bottom-bar entry names the section that owns it, so picking one has
    // to move there rather than leaving a page orphaned in the wrong section.
    const owner = availableSections.find((s) => s.items.some((i) => i.key === key))
    if (owner) section = owner.key
    section_select_page(key)
  }

  // The editor has one section, so its top bar can carry the page title.
  const railed = $derived(wide && availableSections.length === 1 && sectionItems.length > 1)
  $effect(() => { hoisted.on = railed })

  // Switching section lands on its first page.
  function section_select(key: string) {
    section = key
    openInterface = null
    view.section = SECTIONS.find((s) => s.key === key)?.items?.[0]?.key ?? 'unit'
  }

  function section_select_page(key: string) {
    if (key !== 'interfaces') openInterface = null
    view.section = key
  }

  // Keep the current page valid for the active section. A page inside a group is
  // not in the section's own item list, so it has to be counted separately or
  // opening one would immediately navigate away from it.
  $effect(() => {
    const keys = sectionItems.map((i) => i.key)
    const grouped = group_pages(navGroups)
    if (keys.length && !keys.includes(view.section) && !grouped.includes(view.section ?? '')) {
      view.section = keys[0]
    }
  })
</script>


{#snippet unitBody()}
  <PageHeader title={t('Unit Configuration')}>
    {#snippet actions()}<ChangesIndicator {changes} scope="unit" />{/snippet}
  </PageHeader>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.unit)}</p>
  <!-- Guarded rather than defaulted: `?? {}` would hand the renderer a fresh
       object each time, which Svelte does not own, so edits would not stick. -->
  {#if store.doc.unit}
    <LayoutRenderer data={store.doc.unit as Record<string, unknown>} schema={unitDef ?? {}} layout={unitLayout} />
  {/if}
{/snippet}

{#snippet radiosBody()}
  <PageHeader title={t('Radios')}>
    {#snippet actions()}<ChangesIndicator {changes} scope="radios" />{/snippet}
  </PageHeader>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.radios)}</p>
  <MapEditor
    parent={store.doc as Record<string, unknown>}
    mapKey="radios"
    valueSchema={radioDef ?? null}
    keyLabel="band"
    tabbed
    keyOptions={radioDef?.properties?.band.enum as string[] | undefined}
    makeValue={radio_defaults}
    locked={radiosLocked}
  >
    {#snippet item(radio: Record<string, unknown>, band: string)}
      <LayoutRenderer data={radio} schema={radioDef ?? {}} layout={radioLayout} context={{ band }} />
    {/snippet}
  </MapEditor>
{/snippet}

{#snippet interfacesBody()}
  <p class="page-description">{t(PAGE_DESCRIPTIONS.interfaces)}</p>
  <MapEditor
    parent={store.doc as Record<string, unknown>}
    mapKey="interfaces"
    valueSchema={interfaceDef ?? null}
    keyLabel="interface"
    tabbed
    bind:active={openInterface}
  >
    {#snippet item(iface: Record<string, unknown>, name: string)}
      <LayoutRenderer
        data={iface}
        schema={interfaceDef ?? {}}
        layout={interfaceLayout}
        context={{
          role: (iface as { role?: string }).role,
          allInterfaces: store.doc.interfaces,
          selfName: name,
          radios: store.doc.radios
        }}
      />
    {/snippet}
    {#snippet addModal({ create, close, map }: { create: (name: string, value: Record<string, unknown>) => void, close: () => void, map: Record<string, unknown> })}
      <InterfaceAddForm interfaces={map as Record<string, Interface>} create={create as (n: string, v: Interface) => void} {close} />
    {/snippet}
  </MapEditor>
{/snippet}

{#snippet networkPage(title: string, description: string, scope: string, body: import('svelte').Snippet)}
  <PageHeader {title}>
    {#snippet actions()}<ChangesIndicator {changes} {scope} />{/snippet}
  </PageHeader>
  {#if description}
    <p class="page-description">{t(description)}</p>
  {/if}
  {@render body()}
{/snippet}

{#snippet wirelessBody()}
  {@const primary = primary_iface(store.doc.interfaces as Record<string, unknown>)}
  {#snippet inner()}
    {#if primary?.[1]?.ssids && (primary[1].ssids as Record<string, unknown>).main}
      <LayoutRenderer
        data={(primary[1].ssids as Record<string, Record<string, unknown>>).main}
        schema={ssidDef ?? {}}
        layout={wirelessLayout}
        context={{ radios: store.doc.radios }}
      />
    {:else}
      <p class="text-sm text-zinc-500">{t('This device has no Wi-Fi network configured yet.')}</p>
    {/if}
  {/snippet}
  {@render networkPage(t('Main'), PAGE_DESCRIPTIONS.wireless, `ssid:${primary?.[0] ?? 'lan'}/main`, inner)}
{/snippet}

{#snippet netRadiosBody()}
  <PageHeader title={t('Radios')}>
    {#snippet actions()}<ChangesIndicator {changes} scope="radios" />{/snippet}
  </PageHeader>
  {#if PAGE_DESCRIPTIONS['net-radios']}
    <p class="page-description">{t(PAGE_DESCRIPTIONS['net-radios'])}</p>
  {/if}
  <MapEditor
    parent={store.doc as Record<string, unknown>}
    mapKey="radios"
    valueSchema={radioDef ?? null}
    keyLabel="band"
    tabbed
    keyOptions={radioDef?.properties?.band.enum as string[] | undefined}
    makeValue={radio_defaults}
    locked
  >
    {#snippet item(radio: Record<string, unknown>, band: string)}
      <LayoutRenderer data={radio} schema={radioDef ?? {}} layout={radioIntentLayout} context={{ band }} />
    {/snippet}
  </MapEditor>
{/snippet}

{#snippet guestBody()}
  {#snippet inner()}<GuestSection />{/snippet}
  {@render networkPage(t('Guest'), PAGE_DESCRIPTIONS.guest, 'interface:guest', inner)}
{/snippet}

{#snippet wanBody()}
  {@const wan = (store.doc.interfaces as Record<string, Record<string, unknown>> | undefined)?.wan}
  {#snippet inner()}
    {#if wan}
      <LayoutRenderer data={wan} schema={interfaceDef ?? {}} layout={wanLayout} context={{ role: wan.role as string }} />
    {:else}
      <p class="text-sm text-zinc-500">{t('This device has no uplink interface configured.')}</p>
    {/if}
  {/snippet}
  {@render networkPage(t('WAN'), PAGE_DESCRIPTIONS.wan, 'interface:wan', inner)}
{/snippet}

{#snippet lanBody()}
  {@const primary = primary_iface(store.doc.interfaces as Record<string, unknown>)}
  {#snippet inner()}
    {#if primary && primary[1].role === 'downstream'}
      <LayoutRenderer
        data={primary[1]}
        schema={interfaceDef ?? {}}
        layout={lanLayout}
        context={{ role: 'downstream' }}
      />
    {:else}
      <!-- An access point bridges rather than routes, so the upstream router
           owns the addresses and there is nothing here to set. -->
      <p class="text-sm text-zinc-500">
        {t('This device bridges its local network, so the router upstream of it owns these settings.')}
      </p>
    {/if}
  {/snippet}
  {@render networkPage(t('LAN'), PAGE_DESCRIPTIONS.lan, `interface:${primary?.[0] ?? 'lan'}`, inner)}
{/snippet}

{#snippet netGuestBody()}
  {@const guest = (store.doc.interfaces as Record<string, Record<string, unknown>> | undefined)?.guest}
  <!-- The nav entry is gone in these cases, so this only covers the tick before
       the effect moves off a page that has just stopped applying. -->
  {#if iface_enabled(guest as { disable?: boolean } | undefined) && guest?.role === 'downstream'}
    {#snippet inner()}
      <LayoutRenderer data={guest} schema={interfaceDef ?? {}} layout={guestLayout} context={{ role: 'downstream' }} />
    {/snippet}
    {@render networkPage(t('Guest'), PAGE_DESCRIPTIONS['net-guest'], 'interface:guest', inner)}
  {/if}
{/snippet}

{#snippet changesBody()}
  <p class="page-description">{t(PAGE_DESCRIPTIONS.changes)}</p>
  <ConfigurationPanel {changes} />
{/snippet}

{#snippet bodyFor(key: string | null)}
  {#if key === 'unit'}{@render unitBody()}
  {:else if key === 'radios'}{@render radiosBody()}
  {:else if key === 'interfaces'}{@render interfacesBody()}
  {:else if key === 'wireless'}{@render wirelessBody()}
  {:else if key === 'guest'}{@render guestBody()}
  {:else if key === 'net-radios'}{@render netRadiosBody()}
  {:else if key === 'wan'}{@render wanBody()}
  {:else if key === 'lan'}{@render lanBody()}
  {:else if key === 'net-guest'}{@render netGuestBody()}
  {:else if key === 'changes'}{@render changesBody()}
  {:else if key === 'json'}<JsonPage {preview} />
  {:else if key === 'ntp'}<NtpPage {changes} />
  {:else if key === 'time'}<TimePage {changes} />
  {:else if key?.startsWith('svc:')}<SystemServicePage serviceKey={key.slice(4)} {changes} />
  {:else if key?.startsWith('service:')}<ServicePage serviceKey={key.slice(8)} {changes} toggleable={!deviceSession} />
  {:else if IS_DEVICE && DP}
    {#if key === 'clients'}<DP.NetworkPage />
    {:else if key === 'internet'}<DP.InternetPage />
    {:else if key === 'wired'}<DP.WiredPage />
    {:else if key === 'airtime'}<DP.AirtimePage />
    {:else if key === 'state'}<DP.StatePage />
    {:else if key === 'events'}<DP.EventsPage />
    {:else if key === 'memory'}<DP.MemoryPage />
    {:else if key === 'overview'}<DP.UcoordPage />
    {:else if key === 'reboot' || key === 'firmware' || key === 'factory-reset'}
      <DP.SystemBusy>
        {#snippet children()}
          {#if key === 'reboot'}<DP.RebootPage />
          {:else if key === 'firmware'}<DP.FirmwarePage />
          {:else}<DP.FactoryResetPage />{/if}
        {/snippet}
      </DP.SystemBusy>
    {/if}
  {/if}
{/snippet}


<div class="flex h-screen flex-col bg-surface text-zinc-900">
  {#if screen === 'welcome'}
    <div class="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div class="w-full max-w-lg rounded-base border border-zinc-200 bg-surface p-6 shadow-flat-md">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 class="text-lg font-semibold tracking-tight">{t('uConfig builder')}</h1>
            <p class="mt-1 text-sm text-zinc-500">{t('Intent-based OpenWrt configuration')}</p>
          </div>
        </div>
        {#if connectionLost}
          <p class="mb-4 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t('The connection to the device was lost. Connect again to continue.')}
          </p>
        {/if}
        <p class="text-sm leading-relaxed text-zinc-600">
          {t('Describe the device and export a uConfig document. Choose how to start:')}
        </p>
        <div class="mt-5 flex flex-col gap-4">
          {#if savedConfigs.length}
            <div class="flex items-center gap-2">
              <select class="input" bind:value={welcomeSaved}>
                <option value="">{t('Open a saved configuration…')}</option>
                {#each savedConfigs as name}
                  <option value={name}>{name}</option>
                {/each}
              </select>
              <Button disabled={!welcomeSaved} onclick={start_saved}>{t('Open')}</Button>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-px flex-1 bg-zinc-200"></span>
              <span class="text-xs text-zinc-400">{t('or start fresh')}</span>
              <span class="h-px flex-1 bg-zinc-200"></span>
            </div>
          {/if}
          <Button variant="primary" full onclick={start_default}>{t('Start with the default configuration')}</Button>
          <div class="flex items-center gap-2">
            <span class="h-px flex-1 bg-zinc-200"></span>
            <span class="text-xs text-zinc-400">{t('or start from an example')}</span>
            <span class="h-px flex-1 bg-zinc-200"></span>
          </div>
          <div class="flex items-center gap-2">
            <select class="input" bind:value={welcomeExample}>
              <option value="">{t('Choose an example…')}</option>
              {#each example_names as name}
                <option value={name}>{name}</option>
              {/each}
            </select>
            <Button disabled={!welcomeExample} onclick={start_example}>{t('Start')}</Button>
          </div>
          {#if IS_DEVICE}
          <div class="flex items-center gap-2">
            <span class="h-px flex-1 bg-zinc-200"></span>
            <span class="text-xs text-zinc-400">{t('or connect to a device')}</span>
            <span class="h-px flex-1 bg-zinc-200"></span>
          </div>
          <form class="flex items-center gap-2" onsubmit={(e: SubmitEvent) => { e.preventDefault(); host_connect() }}>
            <input class="input" type="text" autocomplete="off" placeholder={t('IP to connect to')} bind:value={host} />
            <Button type="submit" disabled={!host.trim()}>{t('Connect')}</Button>
          </form>
          {/if}
        </div>
      </div>
    </div>
  {:else if screen === 'wizard' && IS_DEVICE && DP}
    <DP.WizardPage capabilities={capabilities.data} onDone={wizard_done} />
  {:else if screen === 'login'}
    <div class="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div class="w-full max-w-sm rounded-base border border-zinc-200 bg-surface p-8 text-center shadow-flat-md">
        <div class="flex items-center justify-center gap-2.5">
          <BrandMark size={32} />
          <h1 class="text-xl font-semibold tracking-tight">{t('uConfig')}</h1>
        </div>

        <!-- Connecting, loading and the password form differ in height by ~50px.
             The card is vertically centred, so letting it size to its contents
             makes it jump on every transition; reserve the tallest state's
             height and centre the shorter ones inside it. -->
        <div class="mt-6 flex min-h-[6.75rem] flex-col justify-center">
          {#if connState === 'connecting'}
            <div class="flex flex-col items-center gap-3 text-sm text-zinc-500">
              <Spinner class="h-6 w-6 text-zinc-400" />
              <span>{t('Connecting to the device…')}</span>
            </div>
          {:else if connState === 'error'}
            <p class="text-sm text-red-600">{loginError}</p>
            <div class="mt-5"><Button full onclick={login_back}>{t('Back')}</Button></div>
          {:else if loading.active}
            <div class="flex flex-col items-center gap-3 text-sm text-zinc-500">
              <Spinner class="h-6 w-6 text-zinc-400" />
              <span>{t('Loading data…')}</span>
            </div>
            <div class="mt-5 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
              <div class="h-full rounded-full bg-accent transition-all duration-300" style="width: {Math.round((loading.done / loading.total) * 100)}%"></div>
            </div>
          {:else}
            <form class="flex flex-col gap-4" onsubmit={host_login}>
              <input type="hidden" name="username" autocomplete="username" value="admin" />
              <label class="flex flex-col gap-1.5">
                <input class="input text-center" type="password" name="password" autocomplete="current-password" bind:value={password} />
                <span class="text-xs text-zinc-500">{t('Password')}</span>
              </label>
              <Button type="submit" variant="primary" full disabled={loggingIn}>{loggingIn ? t('Logging in…') : t('Log in')}</Button>
            </form>
          {/if}
        </div>

        <!-- Outside the fixed-height body: a wrong password would otherwise
             push the form out of the reserved space and reintroduce the jump. -->
        {#if connState !== 'error' && loginError}
          <p class="mt-4 text-sm text-red-600">{loginError}</p>
        {/if}
      </div>
    </div>
  {:else}
    <TopBar
      sections={wide ? availableSections : []}
      section={activeSection}
      onSelect={section_select}
      deviceModel={capabilities.data?.capabilities?.model ?? null}
      host={deviceSession ? settings.host : null}
      onLogout={deviceSession ? logout : null}
      {railed}
      aligned={wide && sectionItems.length > 0}
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      {#if wide && sectionItems.length > 0}
        <SectionNav items={sectionItems} groups={navGroups} page={view.section} onSelect={section_select_page} changes={changes.length} />
      {/if}
      <main class="min-w-0 flex-1 overflow-y-auto px-6 py-6 pr-4 {wide ? '' : 'pb-24'}">
        {#if loadWarning}
          <p class="mb-5 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t('Could not load the configuration from the device: {error}. Editing a blank document.', { error: loadWarning })}
          </p>
        {/if}
        {#if !wide && activeSection === 'config' && view.section === 'services'}
          <ServiceListPage entries={serviceEntries} onOpen={section_select_page} />
        {:else}
          {@render bodyFor(view.section)}
        {/if}
      </main>
    </div>

    {#if !wide && bottomItems.length > 1}
      <BottomNav items={bottomItems} active={view.section} onSelect={bottom_select} />
    {/if}
  {/if}

  <ConfirmModal />
</div>
