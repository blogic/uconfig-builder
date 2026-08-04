<script>
  import Card from './lib/components/Card.svelte'
  import LayoutRenderer from './lib/components/LayoutRenderer.svelte'
  import MapEditor from './lib/components/MapEditor.svelte'
  import ConfirmModal from './lib/components/ConfirmModal.svelte'
  import ConfigurationPanel from './lib/components/ConfigurationPanel.svelte'
  import Sidebar from './lib/components/Sidebar.svelte'
  import ChangesIndicator from './lib/components/ChangesIndicator.svelte'
  import ServicePage from './lib/components/ServicePage.svelte'
  import JsonPage from './lib/components/JsonPage.svelte'
  import NtpPage from './lib/components/NtpPage.svelte'
  import InterfaceListPage from './lib/components/InterfaceListPage.svelte'
  import InterfaceDetailPage from './lib/components/InterfaceDetailPage.svelte'
  import NetworkPage from './lib/components/NetworkPage.svelte'
  import StatePage from './lib/components/StatePage.svelte'
  import TrafficPage from './lib/components/TrafficPage.svelte'
  import SystemPage from './lib/components/SystemPage.svelte'
  import DeviceCards from './lib/components/DeviceCards.svelte'
  import Spinner from './lib/components/Spinner.svelte'
  import { def_get, title_for } from './lib/schema.js'
  import { SERVICE_CONFIG_KEYS } from './lib/services.js'
  import { PAGE_DESCRIPTIONS } from './lib/descriptions.js'
  import { default_width } from './lib/channels.js'
  import { unitLayout, radioLayout } from './lib/layouts.js'
  import { view } from './lib/view.svelte.js'
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
  import { connection, connect as ws_connect, login as ws_login, request as ws_request, disconnect as ws_disconnect } from './lib/connection.svelte.js'
  import { capabilities, capabilities_set, capabilities_clear } from './lib/capabilities.svelte.js'
  import { devices_clear } from './lib/devices.svelte.js'
  import { sysinfo_clear } from './lib/sysinfo.svelte.js'
  import { traffic_clear } from './lib/traffic.svelte.js'

  const preview = $derived(doc_export())

  const unitDef = def_get('unit')
  const radioDef = def_get('radio')
  // Services plus NTP (which lives under definitions), ordered as the sidebar.
  const serviceCards = [
    ...SERVICE_CONFIG_KEYS.map((key) => ({ key, label: title_for(key) })),
    { key: 'ntp', label: 'NTP' }
  ].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))

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

  let screen = $state('welcome') // 'welcome' | 'login' | 'device' | 'builder'
  let devicePage = $state('network') // 'network' | 'state' | 'system'
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
    example_load('default')
    screen = 'builder'
  }
  function start_example() {
    if (!welcomeExample) return
    example_load(welcomeExample)
    screen = 'builder'
  }
  function start_saved() {
    if (!welcomeSaved) return
    config_load(welcomeSaved)
    screen = 'builder'
  }
  async function host_connect() {
    const h = host.trim()
    if (!h) return
    settings.host = h
    loginError = null
    connectionLost = false
    connection.lost = false
    connState = 'connecting'
    screen = 'login'
    try {
      await ws_connect(h)
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
      await ws_login(password)
      // Pull the device's active config; a fresh device may have none yet.
      try {
        doc_adopt(await ws_request('config-get', {}), settings.host)
      } catch (e) {
        loadWarning = e?.message || String(e)
      }
      try {
        capabilities_set(await ws_request('capabilities', {}))
      } catch {
        /* device did not report capabilities; static defaults apply */
      }
      // Land on the device menu (Network is the default page); Configure opens the builder.
      password = ''
      deviceSession = true
      devicePage = 'network'
      screen = 'device'
    } catch (e) {
      loginError = e?.message || String(e)
    } finally {
      loggingIn = false
    }
  }

  function login_back() {
    ws_disconnect()
    capabilities_clear()
    loginError = null
    connState = 'idle'
    screen = 'welcome'
  }

  function logout() {
    ws_disconnect()
    capabilities_clear()
    devices_clear()
    sysinfo_clear()
    traffic_clear()
    doc_reset()
    loadWarning = null
    deviceSession = false
    screen = 'welcome'
  }

  function back_to_device() {
    devicePage = 'network'
    screen = 'device'
  }

  // A dropped session leaves a signed-in UI that cannot reach the device;
  // reset to the landing page and say why.
  $effect(() => {
    if (!connection.lost) return
    ws_disconnect()
    capabilities_clear()
    devices_clear()
    sysinfo_clear()
    traffic_clear()
    doc_reset()
    deviceSession = false
    connState = 'idle'
    view.section = 'unit'
    loadWarning = null
    loginError = null
    screen = 'welcome'
    connectionLost = true
  })

  const savedConfigs = $derived(saved_names())
  // With device capabilities loaded we know the radios; lock manual add/remove.
  const radiosLocked = $derived(capabilities.data != null)
  function section_select(key) {
    if (key !== 'interfaces') openInterface = null
    view.section = key
  }
  const changes = $derived(changes_list(store.doc, store.baseline))

  // The Changes entry only exists while there are changes; fall through to JSON
  // when the last one is reset or applied away.
  $effect(() => {
    if (view.section === 'changes' && !changes.length) view.section = 'json'
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
  <div class="page-header"><h2 class="page-title">{t('Unit Configuration')}</h2><ChangesIndicator {changes} scope="unit" /></div>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.unit)}</p>
  <LayoutRenderer data={store.doc.unit} schema={unitDef} layout={unitLayout} />
{/snippet}

{#snippet radiosBody()}
  <div class="page-header"><h2 class="page-title">{t('Radios')}</h2><ChangesIndicator {changes} scope="radios" /></div>
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
  <div class="page-header"><h2 class="page-title">{t('Configuration Changes')}</h2></div>
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
  {:else if key?.startsWith('service:')}<ServicePage serviceKey={key.slice(8)} {changes} />{/if}
{/snippet}

<div class="flex h-screen flex-col bg-surface text-zinc-900">
  {@render appMenu()}
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
        </div>
      </div>
    </div>
  {:else if screen === 'login'}
    <div class="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div class="w-full max-w-lg rounded-base border border-zinc-200 bg-surface p-6 shadow-flat-md">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 class="text-lg font-semibold tracking-tight">{t('Log in')}</h1>
            <p class="mt-1 text-sm text-zinc-500">{settings.host}</p>
          </div>
        </div>
        {#if connState === 'connecting'}
          <div class="flex flex-col items-center gap-3 py-8 text-sm text-zinc-500">
            <Spinner class="h-6 w-6 text-zinc-400" />
            <span>{t('Connecting to the device…')}</span>
          </div>
        {:else if connState === 'error'}
          <p class="text-sm text-red-600">{loginError}</p>
          <div class="mt-4 flex justify-end">
            <button type="button" class="btn" onclick={login_back}>{t('Back')}</button>
          </div>
        {:else}
          <form class="flex flex-col gap-4" onsubmit={host_login}>
            <input type="hidden" name="username" autocomplete="username" value="admin" />
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-zinc-700">{t('Password')}</span>
              <input class="input" type="password" name="password" autocomplete="current-password" bind:value={password} />
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
  {:else if screen === 'device'}
    <header class="flex-shrink-0 border-b border-zinc-200 bg-surface shadow-flat-sm">
      <div class="relative mx-auto max-w-5xl px-4 py-3 text-center">
        <h1 class="text-base font-semibold tracking-tight">{capabilities.data?.capabilities?.model ?? t('Device')}</h1>
        <p class="text-xs text-zinc-500">{settings.host}</p>
      </div>
    </header>
    {#if view.mode === 'cards'}
      <main class="flex-1 overflow-y-auto">
        <DeviceCards onConfigure={() => (screen = 'builder')} />
      </main>
    {:else}
      <div class="mx-auto flex w-full max-w-5xl flex-1 gap-4 overflow-hidden px-4">
        <aside class="w-44 flex-shrink-0 overflow-y-auto py-6">
          <nav class="flex h-full flex-col gap-1">
            <button
              type="button"
              class="rounded-base border-l-2 px-3 py-2 text-left text-sm font-medium transition {devicePage === 'network' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-zinc-700 hover:bg-zinc-50'}"
              onclick={() => (devicePage = 'network')}
            >{t('Network')}</button>
            <button
              type="button"
              class="rounded-base border-l-2 px-3 py-2 text-left text-sm font-medium transition {devicePage === 'traffic' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-zinc-700 hover:bg-zinc-50'}"
              onclick={() => (devicePage = 'traffic')}
            >{t('Traffic')}</button>
            <button
              type="button"
              class="rounded-base border-l-2 px-3 py-2 text-left text-sm font-medium transition {devicePage === 'state' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-zinc-700 hover:bg-zinc-50'}"
              onclick={() => (devicePage = 'state')}
            >{t('State')}</button>
            <button
              type="button"
              class="rounded-base border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              onclick={() => (screen = 'builder')}
            >{t('Configure')}</button>
            <button
              type="button"
              class="rounded-base border-l-2 px-3 py-2 text-left text-sm font-medium transition {devicePage === 'system' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-zinc-700 hover:bg-zinc-50'}"
              onclick={() => (devicePage = 'system')}
            >{t('System')}</button>
          </nav>
        </aside>
        <main class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
          {#if devicePage === 'network'}
            <NetworkPage />
          {:else if devicePage === 'traffic'}
            <TrafficPage />
          {:else if devicePage === 'state'}
            <StatePage />
          {:else}
            <SystemPage />
          {/if}
        </main>
      </div>
    {/if}
  {:else}
  {#if view.mode === 'cards'}
    <header class="flex-shrink-0 border-b border-zinc-200 bg-surface">
      <div class="relative mx-auto max-w-3xl px-4 py-3 text-center">
        <h1 class="text-base font-semibold tracking-tight">{t('uConfig builder')}</h1>
        <p class="text-xs text-zinc-500">
          {t('Intent-based OpenWrt configuration')}
          {#if store.loadedFrom}<span class="text-zinc-400"> · {store.loadedFrom}</span>{/if}
        </p>
      </div>
    </header>
    <main class="flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6">
        {#if deviceSession}
          <button type="button" class="self-start text-sm font-medium text-zinc-500 hover:text-zinc-800" onclick={back_to_device}>← {t('Back')}</button>
        {/if}
        <Card title={t('Unit')} subtitle={t('Device identity')}>
          {#snippet children()}<LayoutRenderer data={store.doc.unit} schema={unitDef} layout={unitLayout} />{/snippet}
        </Card>
        <Card title={t('Radios')} subtitle={t('Physical radios by band label')}>
          {#snippet children()}{@render radiosBody()}{/snippet}
        </Card>
        <Card title={t('Interfaces')} subtitle={t('Logical networks, SSIDs, ports')}>
          {#snippet children()}{@render interfacesBody()}{/snippet}
        </Card>
        {#each serviceCards as c (c.key)}
          <Card title={c.label}>
            {#snippet children()}
              {#if c.key === 'ntp'}<NtpPage {changes} />
              {:else}<ServicePage serviceKey={c.key} {changes} />{/if}
            {/snippet}
          </Card>
        {/each}
        <Card title={t('Changes')} badge={changes.length || null}>
          {#snippet children()}<ConfigurationPanel {changes} />{/snippet}
        </Card>
        <Card title={t('JSON')}>
          {#snippet children()}<JsonPage {preview} />{/snippet}
        </Card>
      </div>
    </main>
  {:else}
    <div class="flex flex-1 overflow-hidden">
      <Sidebar
        section={view.section}
        onSelect={section_select}
        changes={changes.length}
        {deviceSession}
        onBack={back_to_device}
      />
      <main class="min-w-0 flex-1 overflow-y-auto bg-surface px-8 py-7">
        {#if loadWarning}
          <p class="mb-5 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t('Could not load the configuration from the device: {error}. Editing a blank document.', { error: loadWarning })}
          </p>
        {/if}
        {@render bodyFor(view.section)}
      </main>
    </div>
  {/if}
  {/if}

  <ConfirmModal />
</div>
