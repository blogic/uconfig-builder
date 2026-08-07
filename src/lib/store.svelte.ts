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
    // Presence of the block is what marks a service enabled, so defaults are
    // seeded into one that already exists and never bring it into being.
    if (!services[key]) continue
    for (const [prop, raw] of Object.entries(sch.properties ?? {})) {
      const ps = ref_resolve(raw)
      if (ps.default === undefined) continue
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

// An include fragment: a partial document merged into the main config at the
// point its `include` reference sits. `uuid` is assigned by the device and
// orders ucoord's peer sync, so the client never writes it.
export type IncludeFragment = Record<string, unknown> & { uuid?: number }

// What `config-get` returns and `config-apply` accepts: the main document and
// its fragments together, so one call carries the whole config state.
// A type alias rather than an interface: `request()` takes a
// Record<string, unknown>, which an interface cannot satisfy for want of an
// index signature.
export type ConfigPayload = {
  config: UconfigDocument
  includes: Record<string, IncludeFragment>
}

// A reply without a `config` key predates the envelope and is the bare
// document, so an un-updated device still loads.
export function payload_normalise(raw: unknown): ConfigPayload {
  if (raw && typeof raw === 'object' && 'config' in raw) {
    const p = raw as { config: UconfigDocument; includes?: Record<string, IncludeFragment> }
    return { config: p.config, includes: p.includes ?? {} }
  }
  return { config: raw as UconfigDocument, includes: {} }
}

export const store = $state<{
  doc: UconfigDocument
  includes: Record<string, IncludeFragment>
  baseline: UconfigDocument | null
  includeBaselines: Record<string, IncludeFragment> | null
  loadedFrom: string | null
}>({
  doc: blank_doc(),
  includes: {},
  baseline: null,
  includeBaselines: null,
  loadedFrom: null
})

function baseline_snapshot() {
  store.baseline = structuredClone($state.snapshot(store.doc))
  store.includeBaselines = structuredClone($state.snapshot(store.includes))
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
  // Absent in the baseline means the fragment did not exist there, so resetting
  // removes it rather than restoring an empty one.
  if (scope.startsWith('include:')) {
    const name = scope.slice(8)
    const base = store.includeBaselines?.[name]
    if (base === undefined) delete store.includes[name]
    else store.includes[name] = structuredClone($state.snapshot(base)) as IncludeFragment
    return
  }
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

  // A single interface, so resetting one network leaves the others alone.
  // Absent in the baseline means it was added since, and resetting removes it.
  if (scope.startsWith('interface:')) {
    const name = scope.slice(10)
    if (!store.doc.interfaces || typeof store.doc.interfaces !== 'object') store.doc.interfaces = {}
    const ifaces = store.doc.interfaces as Record<string, Record<string, unknown>>
    const baseIface = (base.interfaces as Record<string, Record<string, unknown>> | undefined)?.[name]
    if (baseIface === undefined) {
      delete ifaces[name]
      return
    }
    // The SSIDs are tracked under their own scopes, so restoring the interface
    // must leave them as they are rather than silently undoing a wireless edit.
    const ssids = ifaces[name]?.ssids
    ifaces[name] = baseIface
    if (ssids !== undefined) ifaces[name].ssids = ssids
    else delete ifaces[name].ssids
    return
  }

  // One SSID, addressed as `<interface>/<ssid>`. Restoring it leaves the rest of
  // the interface as it is, so a wireless page resets only the network it edits.
  if (scope.startsWith('ssid:')) {
    const cut = scope.indexOf('/')
    if (cut === -1) return
    const iface = scope.slice(5, cut)
    const name = scope.slice(cut + 1)
    const target = (store.doc.interfaces as Record<string, Record<string, unknown>> | undefined)?.[iface]
    if (!target) return
    const baseSsids = (base.interfaces as Record<string, Record<string, unknown>> | undefined)?.[iface]
      ?.ssids as Record<string, unknown> | undefined
    if (!target.ssids || typeof target.ssids !== 'object') target.ssids = {}
    const ssids = target.ssids as Record<string, unknown>
    if (baseSsids?.[name] === undefined) delete ssids[name]
    else ssids[name] = baseSsids[name]
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
    // Absent in the baseline means the service was disabled there, so resetting
    // has to remove it rather than restore an empty block.
    if (baseServices?.[key] === undefined) delete services[key]
    else services[key] = baseServices[key]
    service_defaults(store.doc)
  }
}

export function service_enabled(key: string): boolean {
  return (store.doc.services as Record<string, unknown> | undefined)?.[key] !== undefined
}

// Schema defaults for a service, used when the running config never had it.
function service_seed(key: string): Record<string, unknown> {
  const serviceDef = def_get('service')
  if (!serviceDef) return {}
  const sch = ref_resolve(schema_at(serviceDef, key))
  const out: Record<string, unknown> = {}
  for (const [prop, raw] of Object.entries(sch.properties ?? {})) {
    const ps = ref_resolve(raw)
    if (ps.default !== undefined) out[prop] = ps.default
  }
  return out
}

// Re-enabling restores what the device is running rather than a blank block,
// so toggling a service off and on again before an apply loses nothing.
export function service_enable(key: string) {
  if (!store.doc.services || typeof store.doc.services !== 'object') store.doc.services = {}
  const services = store.doc.services as Record<string, unknown>
  if (services[key] !== undefined) return
  const base = (store.baseline?.services as Record<string, unknown> | undefined)?.[key]
  services[key] = base !== undefined ? structuredClone($state.snapshot(base)) : service_seed(key)
}

// Interface service lists are left alone: the render pipeline ignores a
// reference to a service that is not enabled.
export function service_disable(key: string) {
  const services = store.doc.services as Record<string, unknown> | undefined
  if (services) delete services[key]
}

// Discard every edit, restoring the document as it was loaded. Distinct from
// doc_reset, which blanks the document and starts over.
export function changes_reset() {
  if (!store.baseline) return
  store.doc = structuredClone($state.snapshot(store.baseline)) as UconfigDocument
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  store.includes = structuredClone($state.snapshot(store.includeBaselines ?? {})) as Record<
    string,
    IncludeFragment
  >
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

export function doc_adopt(source: UconfigDocument | ConfigPayload, label: string) {
  const payload = payload_normalise(source)
  store.doc = structuredClone($state.snapshot(payload.config)) as UconfigDocument
  ensure_sections()
  unit_defaults(store.doc)
  service_defaults(store.doc)
  // Deliberately not normalised: a fragment is a partial document, and seeding
  // unit/radios/interfaces/services defaults into one would deep-merge every
  // materialised key into the main config on the device.
  store.includes = structuredClone($state.snapshot(payload.includes)) as Record<string, IncludeFragment>
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

// The whole config state for `config-apply`. The fragment set is complete:
// omitting a name is how a deletion is expressed, so every fragment still held
// has to be sent. `prune` drops an object that empties out, which would read as
// an accidental deletion, so a pruned-away fragment is sent as `{}` instead.
export function payload_export(): ConfigPayload {
  const includes: Record<string, IncludeFragment> = {}
  for (const [name, fragment] of Object.entries($state.snapshot(store.includes))) {
    const pruned = prune(fragment)
    includes[name] = (pruned && typeof pruned === 'object' ? pruned : {}) as IncludeFragment
  }
  return { config: prune(store.doc) as UconfigDocument, includes }
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
