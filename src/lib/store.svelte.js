import examples from './data/examples.json'
import timezones from './data/timezones.json'
import { def_get, schema_at, ref_resolve } from './schema.js'
import { SERVICE_CONFIG_KEYS } from './services.js'
import { settings } from './settings.svelte.js'

export { examples }

export const tz_keys = Object.keys(timezones).sort()

export function tz_resolve() {
  try {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browser) {
      const spaced = browser.replace(/_/g, ' ')
      if (timezones[spaced]) return spaced
      if (timezones[browser]) return browser
    }
  } catch {
    /* Intl unavailable */
  }
  return tz_keys.includes('Europe/London') ? 'Europe/London' : tz_keys[0]
}

function unit_defaults(doc) {
  if (!doc.unit || typeof doc.unit !== 'object') doc.unit = {}
  if (!doc.unit.timezone) doc.unit.timezone = tz_resolve()
  if (!doc.unit.hostname) doc.unit.hostname = 'OpenWrt'
  if (doc.unit['leds-active'] === undefined) doc.unit['leds-active'] = true
  if (doc.unit['tty-login'] === undefined) doc.unit['tty-login'] = false
}

// Pre-populate defaults for available services up front (not lazily on first
// open), for the top-level fields shown in the UI.
function service_defaults(doc) {
  if (!doc.services || typeof doc.services !== 'object') doc.services = {}
  for (const key of SERVICE_CONFIG_KEYS) {
    const sch = ref_resolve(schema_at(def_get('service'), key))
    for (const [prop, raw] of Object.entries(sch.properties ?? {})) {
      const ps = ref_resolve(raw)
      if (ps.default === undefined) continue
      if (!doc.services[key]) doc.services[key] = {}
      if (doc.services[key][prop] === undefined) doc.services[key][prop] = ps.default
    }
  }
}

function blank_doc() {
  const doc = {
    unit: {},
    radios: {},
    interfaces: {},
    services: {}
  }
  unit_defaults(doc)
  service_defaults(doc)
  return doc
}

export const store = $state({
  doc: blank_doc(),
  baseline: null,
  loadedFrom: null
})

function baseline_snapshot() {
  store.baseline = structuredClone($state.snapshot(store.doc))
}
baseline_snapshot()

// Adopt the current document as the new baseline (e.g. after a successful apply),
// so the pending-changes list resets to empty.
export function baseline_reset() {
  baseline_snapshot()
}

// Restore a single nav section from the baseline, leaving the rest of the
// document untouched. Scopes match `changes_list`'s `scope` field.
export function scope_reset(scope) {
  if (!store.baseline) return
  const base = structuredClone($state.snapshot(store.baseline))
  if (scope === 'unit') {
    store.doc.unit = base.unit ?? {}
    unit_defaults(store.doc)
    return
  }
  if (scope === 'radios' || scope === 'interfaces') {
    store.doc[scope] = base[scope] ?? {}
    return
  }
  if (scope === 'ntp') {
    if (!store.doc.definitions || typeof store.doc.definitions !== 'object') store.doc.definitions = {}
    const servers = base.definitions?.['ntp-servers']
    if (servers) store.doc.definitions['ntp-servers'] = servers
    else delete store.doc.definitions['ntp-servers']
    return
  }
  if (scope.startsWith('service:')) {
    const key = scope.slice(8)
    if (!store.doc.services || typeof store.doc.services !== 'object') store.doc.services = {}
    store.doc.services[key] = base.services?.[key] ?? {}
    service_defaults(store.doc)
  }
}

export function doc_reset() {
  store.doc = blank_doc()
  store.loadedFrom = null
  baseline_snapshot()
}

export function example_load(name) {
  const src = examples[name]
  if (!src) return
  store.doc = structuredClone(src)
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = name
  baseline_snapshot()
}

export function doc_import(text) {
  const cleaned = text.replace(/,(\s*[}\]])/g, '$1')
  const parsed = JSON.parse(cleaned)
  store.doc = parsed
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = 'imported'
  baseline_snapshot()
}

export function doc_adopt(obj, label) {
  store.doc = structuredClone(obj)
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = label
  baseline_snapshot()
}

export function saved_names() {
  return Object.keys(settings.configs ?? {}).sort()
}

export function config_save(name) {
  if (!settings.configs) settings.configs = {}
  settings.configs[name] = prune(structuredClone($state.snapshot(store.doc)))
  store.loadedFrom = name
  baseline_snapshot()
}

export function config_load(name) {
  const saved = settings.configs?.[name]
  if (!saved) return
  store.doc = structuredClone($state.snapshot(saved))
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = name
  baseline_snapshot()
}

export function config_delete(name) {
  if (settings.configs) delete settings.configs[name]
}

function ensure_sections() {
  for (const k of ['unit', 'radios', 'interfaces', 'services']) {
    if (store.doc[k] == null || typeof store.doc[k] !== 'object') store.doc[k] = {}
  }
}

export function doc_export() {
  return JSON.stringify(prune(store.doc), null, '\t') + '\n'
}

function prune(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v)
      const empty_obj = pv && typeof pv === 'object' && !Array.isArray(pv) && Object.keys(pv).length === 0
      if (pv === undefined || pv === '' || empty_obj) continue
      out[k] = pv
    }
    return out
  }
  return value
}

export const example_names = Object.keys(examples).sort()
