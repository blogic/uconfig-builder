import type { UconfigDocument } from './types/uconfig'
import examplesJson from './data/examples.json'
import timezones from './data/timezones.json'
import { def_get, schema_at, ref_resolve } from './schema.ts'
import { SERVICE_CONFIG_KEYS } from './services.ts'
import { settings } from './settings.svelte.ts'

// The example documents are full uconfig documents keyed by name; the JSON
// import itself is inferred from the literal file contents rather than the
// generated schema types.
export const examples = examplesJson as unknown as Record<string, UconfigDocument>

export const tz_keys = Object.keys(timezones).sort()

// The browser's zone, but only when this build knows it. Null rather than a
// fallback, so a caller offering to sync can tell a real match from a guess.
export function tz_browser(): string | null {
  try {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browser) {
      const spaced = browser.replace(/_/g, ' ')
      if ((timezones as Record<string, unknown>)[spaced]) return spaced
      if ((timezones as Record<string, unknown>)[browser]) return browser
    }
  } catch {
    /* Intl unavailable */
  }
  return null
}

export function tz_resolve(): string {
  return tz_browser() ?? (tz_keys.includes('Europe/London') ? 'Europe/London' : tz_keys[0])
}

function unit_defaults(doc: UconfigDocument) {
  if (!doc.unit || typeof doc.unit !== 'object') doc.unit = {}
  if (!doc.unit.timezone) doc.unit.timezone = tz_resolve()
  if (!doc.unit.hostname) doc.unit.hostname = 'OpenWrt'
  if (doc.unit['leds-active'] === undefined) doc.unit['leds-active'] = true
  if (doc.unit['tty-login'] === undefined) doc.unit['tty-login'] = false
}

// Pre-populate defaults for available services up front (not lazily on first
// open), for the top-level fields shown in the UI.
function service_defaults(doc: UconfigDocument) {
  if (!doc.services || typeof doc.services !== 'object') doc.services = {}
  const services = doc.services as Record<string, Record<string, unknown>>
  const serviceDef = def_get('service')
  if (!serviceDef) return
  for (const key of SERVICE_CONFIG_KEYS as string[]) {
    const sch = ref_resolve(schema_at(serviceDef, key))
    for (const [prop, raw] of Object.entries(sch.properties ?? {})) {
      const ps = ref_resolve(raw)
      if (ps.default === undefined) continue
      if (!services[key]) services[key] = {}
      if (services[key][prop] === undefined) services[key][prop] = ps.default
    }
  }
}

function blank_doc(): UconfigDocument {
  const doc: UconfigDocument = {
    unit: {},
    radios: {},
    interfaces: {},
    services: {}
  }
  unit_defaults(doc)
  service_defaults(doc)
  return doc
}

export const store = $state<{
  doc: UconfigDocument
  baseline: UconfigDocument | null
  loadedFrom: string | null
}>({
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
export function scope_reset(scope: string) {
  if (!store.baseline) return
  const base = structuredClone($state.snapshot(store.baseline)) as UconfigDocument
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
    const services = store.doc.services as Record<string, unknown>
    const baseServices = base.services as Record<string, unknown> | undefined
    services[key] = baseServices?.[key] ?? {}
    service_defaults(store.doc)
  }
}

// Discard every edit, restoring the document as it was loaded. Distinct from
// doc_reset, which blanks the document and starts over.
export function changes_reset() {
  if (!store.baseline) return
  store.doc = structuredClone($state.snapshot(store.baseline)) as UconfigDocument
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
}

export function doc_reset() {
  store.doc = blank_doc()
  store.loadedFrom = null
  baseline_snapshot()
}

export function example_load(name: string) {
  const src = examples[name]
  if (!src) return
  store.doc = structuredClone(src)
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = name
  baseline_snapshot()
}

export function doc_import(text: string) {
  const cleaned = text.replace(/,(\s*[}\]])/g, '$1')
  const parsed: UconfigDocument = JSON.parse(cleaned)
  store.doc = parsed
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = 'imported'
  baseline_snapshot()
}

export function doc_adopt(obj: UconfigDocument, label: string) {
  store.doc = structuredClone(obj)
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = label
  baseline_snapshot()
}

export function saved_names(): string[] {
  return Object.keys(settings.configs ?? {}).sort()
}

export function config_save(name: string) {
  if (!settings.configs) settings.configs = {}
  settings.configs[name] = prune(structuredClone($state.snapshot(store.doc))) as UconfigDocument
  store.loadedFrom = name
  baseline_snapshot()
}

export function config_load(name: string) {
  const saved = settings.configs?.[name]
  if (!saved) return
  store.doc = structuredClone($state.snapshot(saved)) as UconfigDocument
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.loadedFrom = name
  baseline_snapshot()
}

export function config_delete(name: string) {
  if (settings.configs) delete settings.configs[name]
}

function ensure_sections() {
  const doc = store.doc as Record<string, unknown>
  for (const k of ['unit', 'radios', 'interfaces', 'services']) {
    if (doc[k] == null || typeof doc[k] !== 'object') doc[k] = {}
  }
}

export function doc_export(): string {
  return JSON.stringify(prune(store.doc), null, '\t') + '\n'
}

function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v)
      const empty_obj = pv != null && typeof pv === 'object' && !Array.isArray(pv) && Object.keys(pv).length === 0
      if (pv === undefined || pv === '' || empty_obj) continue
      out[k] = pv
    }
    return out
  }
  return value
}

export const example_names = Object.keys(examples).sort()
