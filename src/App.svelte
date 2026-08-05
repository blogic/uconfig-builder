<script>
  import LayoutRenderer from './lib/components/LayoutRenderer.svelte'
  import MapEditor from './lib/components/MapEditor.svelte'
  import ConfirmModal from './lib/components/ConfirmModal.svelte'
  import ConfigurationPanel from './lib/components/ConfigurationPanel.svelte'
  import ChangesIndicator from './lib/components/ChangesIndicator.svelte'
  import PageHeader from './lib/components/PageHeader.svelte'
  import ServicePage from './lib/components/ServicePage.svelte'
  import JsonPage from './lib/components/JsonPage.svelte'
  import NtpPage from './lib/components/NtpPage.svelte'
  import InterfaceListPage from './lib/components/InterfaceListPage.svelte'
  import InterfaceDetailPage from './lib/components/InterfaceDetailPage.svelte'
  import BottomNav from './lib/components/BottomNav.svelte'
  import TopBar from './lib/components/TopBar.svelte'
  import SectionNav from './lib/components/SectionNav.svelte'
  import ServiceListPage from './lib/components/ServiceListPage.svelte'
  import Spinner from './lib/components/Spinner.svelte'
  import BrandMark from './lib/components/BrandMark.svelte'
  import { def_get, title_for } from './lib/schema.js'
  import { SERVICE_ENTRIES, SECTIONS, sections_for } from './lib/nav.js'
  import { IS_DEVICE, IS_EDITOR } from './lib/flavour.js'
  import { PAGE_DESCRIPTIONS } from './lib/descriptions.js'
  import { default_width } from './lib/channels.js'
  import { unitLayout, radioLayout } from './lib/layouts.js'
  import { view } from './lib/view.svelte.js'
  import { route, route_parse, route_sync, route_clear } from './lib/router.svelte.js'
  import { hoisted } from './lib/page.svelte.js'
  import { confirm } from './lib/confirm.svelte.js'
  import { settings } from './lib/settings.svelte.js'
  import { accordion_provide } from './lib/accordion.svelte.js'
  import { changes_list } from './lib/changes.js'
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
  import { device_load, deviceApi } from './lib/device.svelte.js'

  // Device modules load on demand; in the editor build the branch is dropped
  // and nothing below ever runs.
  let dev = $state(null)
  const connection = $derived(dev?.conn.connection ?? { status: 'idle', lost: false })
  const capabilities = $derived(dev?.caps.capabilities ?? { data: null })

  async function device_ready() {
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
  let openInterface = $state(null)

  function radio_defaults(band) {
    return { 'channel-mode': 'HE', 'channel-width': default_width(band) }
  }

  // Top-level cards (cards view) act as a single accordion.
  accordion_provide()

  // Effective theme follows the OS until the user picks one (then it's persisted).
  const mql = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
  let systemDark = $state(mql?.matches ?? false)
  mql?.addEventListener?.('change', (e) => (systemDark = e.matches))
  const themeMode = $derived(settings.theme ?? (systemDark ? 'dark' : 'light'))

  $effect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
    document.documentElement.style.colorScheme = themeMode
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', themeMode)
  })
  function toggle_theme() {
    settings.theme = themeMode === 'dark' ? 'light' : 'dark'
  }

  // Menu (sidebar) layout on desktop, stacked cards on mobile.
  const wideMql = globalThis.matchMedia?.('(min-width: 768px)')
  let wide = $state(wideMql?.matches ?? true)
  wideMql?.addEventListener?.('change', (e) => (wide = e.matches))
  $effect(() => {
    view.mode = wide ? 'menu' : 'cards'
  })

  let screen = $state('welcome') // 'welcome' | 'login' | 'app'
  let section = $state('config') // 'status' | 'config' | 'system'
  let deviceSession = $state(false) // logged into a device (survives idle disconnects)
  let menuOpen = $state(false)
  let welcomeExample = $state('')
  let welcomeSaved = $state('')
  let host = $state(settings.host ?? '')
  let password = $state('')
  let loginError = $state(null)
  let loadWarning = $state(null) // config-get failed, editing a blank document
  let connectionLost = $state(false) // session dropped; shown on the landing page
  let loggingIn = $state(false)
  let connState = $state('idle') // 'connecting' | 'ready' | 'error'
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
      await d.conn.connect(h)
      connState = 'ready'
    } catch (e) {
      connState = 'error'
      loginError = e?.message || String(e)
    }
  }
  async function host_login(event) {
    event?.preventDefault()
    if (loggingIn) return
    loginError = null
    loadWarning = null
    loggingIn = true
    try {
      await dev.conn.login(password)
      // Pull the device's active config; a fresh device may have none yet.
      try {
        doc_adopt(await dev.conn.request('config-get', {}), settings.host)
      } catch (e) {
        loadWarning = e?.message || String(e)
      }
      try {
        dev.caps.capabilities_set(await dev.conn.request('capabilities', {}))
      } catch {
        /* device did not report capabilities; static defaults apply */
      }
      password = ''
      deviceSession = true
      section = IS_DEVICE ? 'status' : 'config'
      view.section = IS_DEVICE ? 'clients' : 'unit'

      // Seed every live page before leaving the login card, so the app appears
      // fully populated rather than filling in behind visible chrome.
      if (IS_DEVICE) await dev.poll.preload()
      screen = 'app'
    } catch (e) {
      loginError = e?.message || String(e)
    } finally {
      loggingIn = false
    }
  }

  function login_back() {
    device_reset()
    loginError = null
    connState = 'idle'
    screen = 'welcome'
    route_clear()
  }

  function logout() {
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

  function route_apply(r) {
    if (!r) return
    // A route only makes sense once a session exists; ignore it otherwise.
    if (r.section === 'status' && !deviceSession) return
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
  const changes = $derived(changes_list(store.doc, store.baseline))

  // Sections available for this build and breakpoint. System and Configure are
  // desktop-only: reboot, firmware and schema editing are not phone errands.
  const availableSections = $derived(sections_for(IS_DEVICE, IS_EDITOR, wide, deviceSession))
  const activeSection = $derived(
    availableSections.some((s) => s.key === section) ? section : (availableSections[0]?.key ?? 'config')
  )
  const sectionItems = $derived(
    (availableSections.find((s) => s.key === activeSection)?.items ?? []).filter(
      (i) => !i.whenChanges || changes.length > 0
    )
  )

  // The editor has one section, so its top bar can carry the page title.
  const railed = $derived(wide && availableSections.length === 1 && sectionItems.length > 1)
  $effect(() => { hoisted.on = railed })

  // Switching section lands on its first page.
  function section_select(key) {
    section = key
    openInterface = null
    view.section = SECTIONS.find((s) => s.key === key)?.items?.[0]?.key ?? 'unit'
  }

  function section_select_page(key) {
    if (key !== 'interfaces') openInterface = null
    view.section = key
  }

  // Keep the current page valid for the active section.
  $effect(() => {
    const keys = sectionItems.map((i) => i.key)
    const inServices = view.section?.startsWith('service:') || view.section === 'ntp'
    if (keys.length && !keys.includes(view.section) && !inServices) view.section = keys[0]
  })
</script>

{#snippet appMenu()}
  {#if menuOpen}
    <button type="button" class="fixed inset-0 z-40 cursor-default" aria-label={t('Close menu')} onclick={() => (menuOpen = false)}></button>
  {/if}
  <div class="fixed right-4 top-3 z-50">
    <button type="button" class="btn" aria-label={t('Menu')} aria-haspopup="true" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    </button>
    {#if menuOpen}
      <div class="absolute right-0 mt-1 w-44 overflow-hidden rounded-base border border-zinc-200 bg-surface py-1 shadow-lg">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100" onclick={() => { menuOpen = false; toggle_theme() }}>
          {#if themeMode === 'dark'}
            <svg class="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            {t('Light theme')}
          {:else}
            <svg class="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            {t('Dark theme')}
          {/if}
        </button>
        {#if deviceSession}
          <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100" onclick={() => { menuOpen = false; logout() }}>
            <svg class="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t('Logout')}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet unitBody()}
  <PageHeader title={t('Unit Configuration')}>
    {#snippet actions()}<ChangesIndicator {changes} scope="unit" />{/snippet}
  </PageHeader>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.unit)}</p>
  <LayoutRenderer data={store.doc.unit} schema={unitDef} layout={unitLayout} />
{/snippet}

{#snippet radiosBody()}
  <PageHeader title={t('Radios')}>
    {#snippet actions()}<ChangesIndicator {changes} scope="radios" />{/snippet}
  </PageHeader>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.radios)}</p>
  <MapEditor
    parent={store.doc}
    mapKey="radios"
    valueSchema={radioDef}
    keyLabel="band"
    tabbed
    keyOptions={radioDef.properties.band.enum}
    makeValue={radio_defaults}
    locked={radiosLocked}
  >
    {#snippet item(radio, band)}
      <LayoutRenderer data={radio} schema={radioDef} layout={radioLayout} context={{ band }} />
    {/snippet}
  </MapEditor>
{/snippet}

{#snippet interfacesBody()}
  {#if openInterface != null}
    <InterfaceDetailPage name={openInterface} {changes} onBack={() => (openInterface = null)} />
  {:else}
    <InterfaceListPage {changes} onOpen={(n) => (openInterface = n)} />
  {/if}
{/snippet}

{#snippet changesBody()}
  <PageHeader title={t('Configuration Changes')} />
  <p class="page-description">{t(PAGE_DESCRIPTIONS.changes)}</p>
  <ConfigurationPanel {changes} />
{/snippet}

{#snippet bodyFor(key)}
  {#if key === 'unit'}{@render unitBody()}
  {:else if key === 'radios'}{@render radiosBody()}
  {:else if key === 'interfaces'}{@render interfacesBody()}
  {:else if key === 'changes'}{@render changesBody()}
  {:else if key === 'json'}<JsonPage {preview} />
  {:else if key === 'ntp'}<NtpPage {changes} />
  {:else if key?.startsWith('service:')}<ServicePage serviceKey={key.slice(8)} {changes} />
  {:else if IS_DEVICE && DP}
    {#if key === 'clients'}<DP.NetworkPage />
    {:else if key === 'traffic'}<DP.TrafficPage />
    {:else if key === 'state'}<DP.StatePage />
    {:else if key === 'ucoord'}<DP.UcoordPage />
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
    {@render appMenu()}
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
              <button type="button" class="btn disabled:cursor-not-allowed disabled:opacity-50" disabled={!welcomeSaved} onclick={start_saved}>
                {t('Open')}
              </button>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-px flex-1 bg-zinc-200"></span>
              <span class="text-xs text-zinc-400">{t('or start fresh')}</span>
              <span class="h-px flex-1 bg-zinc-200"></span>
            </div>
          {/if}
          <button type="button" class="btn-primary rounded-base px-3 py-2 text-sm font-medium" onclick={start_default}>
            {t('Start with the default configuration')}
          </button>
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
            <button type="button" class="btn disabled:cursor-not-allowed disabled:opacity-50" disabled={!welcomeExample} onclick={start_example}>
              {t('Start')}
            </button>
          </div>
          {#if IS_DEVICE}
          <div class="flex items-center gap-2">
            <span class="h-px flex-1 bg-zinc-200"></span>
            <span class="text-xs text-zinc-400">{t('or connect to a device')}</span>
            <span class="h-px flex-1 bg-zinc-200"></span>
          </div>
          <form class="flex items-center gap-2" onsubmit={(e) => { e.preventDefault(); host_connect() }}>
            <input class="input" type="text" autocomplete="off" placeholder={t('IP to connect to')} bind:value={host} />
            <button type="submit" class="btn disabled:cursor-not-allowed disabled:opacity-50" disabled={!host.trim()}>
              {t('Connect')}
            </button>
          </form>
          {/if}
        </div>
      </div>
    </div>
  {:else if screen === 'login'}
    {@render appMenu()}
    <div class="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div class="w-full max-w-sm rounded-base border border-zinc-200 bg-surface p-8 text-center shadow-flat-md">
        <div class="flex items-center justify-center gap-2.5">
          <BrandMark size={32} />
          <h1 class="text-xl font-semibold tracking-tight">{t('uConfig')}</h1>
        </div>

        {#if connState === 'connecting'}
          <div class="mt-6 flex flex-col items-center gap-3 text-sm text-zinc-500">
            <Spinner class="h-6 w-6 text-zinc-400" />
            <span>{t('Connecting to the device…')}</span>
          </div>
        {:else if connState === 'error'}
          <p class="mt-6 text-sm text-red-600">{loginError}</p>
          <button type="button" class="btn mt-5 w-full justify-center" onclick={login_back}>{t('Back')}</button>
        {:else if loading.active}
          <div class="mt-6 flex flex-col items-center gap-3 text-sm text-zinc-500">
            <Spinner class="h-6 w-6 text-zinc-400" />
            <span>{t('Loading data…')}</span>
          </div>
          <div class="mt-5 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
            <div class="h-full rounded-full bg-accent transition-all duration-300" style="width: {Math.round((loading.done / loading.total) * 100)}%"></div>
          </div>
        {:else}
          <form class="mt-6 flex flex-col gap-4" onsubmit={host_login}>
            <input type="hidden" name="username" autocomplete="username" value="admin" />
            <label class="flex flex-col gap-1.5">
              <input class="input text-center" type="password" name="password" autocomplete="current-password" bind:value={password} />
              <span class="text-xs text-zinc-500">{t('Password')}</span>
            </label>
            {#if loginError}
              <p class="text-sm text-red-600">{loginError}</p>
            {/if}
            <button type="submit" class="btn-primary w-full justify-center rounded-base px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={loggingIn}>
              {loggingIn ? t('Logging in…') : t('Log in')}
            </button>
          </form>
        {/if}
      </div>
    </div>
  {:else}
    <TopBar
      sections={availableSections}
      section={activeSection}
      onSelect={section_select}
      deviceModel={capabilities.data?.capabilities?.model ?? null}
      host={deviceSession ? settings.host : null}
      {themeMode}
      onToggleTheme={toggle_theme}
      onLogout={deviceSession ? logout : null}
      {railed}
      aligned={wide && sectionItems.length > 1}
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      {#if wide && sectionItems.length > 1}
        <SectionNav items={sectionItems} page={view.section} onSelect={section_select_page} changes={changes.length} />
      {/if}
      <main class="min-w-0 flex-1 overflow-y-auto px-6 py-6 pr-4 {wide ? '' : 'pb-24'}">
        {#if loadWarning}
          <p class="mb-5 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t('Could not load the configuration from the device: {error}. Editing a blank document.', { error: loadWarning })}
          </p>
        {/if}
        {#if !wide && activeSection === 'config' && view.section === 'services'}
          <ServiceListPage entries={SERVICE_ENTRIES} onOpen={section_select_page} />
        {:else}
          {@render bodyFor(view.section)}
        {/if}
      </main>
    </div>

    {#if !wide && sectionItems.length > 1}
      <BottomNav items={sectionItems} active={view.section} onSelect={section_select_page} />
    {/if}
  {/if}

  <ConfirmModal />
</div>
