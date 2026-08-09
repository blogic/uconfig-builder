import { ref_resolve, def_get, title_for, pattern_value_schema, rootSchema } from './schema'
import { SYSTEM_SERVICES } from './services'
import type { JsonSchemaNode } from './schema'
import type { IncludeFragment } from './store.svelte'
import { default_width } from './channels'
import { t } from './i18n.svelte'
import type { UconfigDocument, Unit, Radio, Interface, Interface4 } from './types/uconfig'

type JsonValue = string | number | boolean | JsonObject | JsonValue[] | null | undefined
interface JsonObject {
  [key: string]: JsonValue
}

// Reduce a value to a default-stripped, empty-pruned canonical form so that
// defaults the UI materialises while a section is merely viewed do not register
// as edits. Only values the user has actually changed away from their default
// survive.
function strip(value: JsonValue, schema?: JsonSchemaNode): JsonValue {
  const resolved = schema ? ref_resolve(schema) : undefined
  if (Array.isArray(value)) return value.length ? value : undefined
  if (value && typeof value === 'object') {
    const props = resolved?.properties ?? {}
    const ppNode = resolved?.patternProperties
    const ppS = ppNode ? ref_resolve(Object.values(ppNode)[0]) : undefined
    const out: JsonObject = {}
    for (const [k, v] of Object.entries(value)) {
      const cs = props[k] ? ref_resolve(props[k]) : ppS
      const sv = strip(v, cs)
      if (sv === undefined) continue
      if (cs && sv === cs.default) continue
      out[k] = sv
    }
    return Object.keys(out).length ? out : undefined
  }
  if (value === '' || value == null) return undefined
  return value
}

function clean(obj: JsonObject | undefined): JsonObject | undefined {
  if (!obj) return undefined
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k]
  return Object.keys(obj).length ? obj : undefined
}

function canon_unit(u: Unit | undefined): JsonValue {
  return strip(u as JsonValue, def_get('unit'))
}

function canon_radio(r: Radio | undefined, band: string): JsonObject | undefined {
  const s = strip(r as JsonValue, def_get('radio'))
  if (!s || typeof s !== 'object' || Array.isArray(s)) return undefined
  if (s.channel === 'auto') delete s.channel
  if (s['tx-power'] === 30) delete s['tx-power']
  if (s['channel-width'] === default_width(band)) delete s['channel-width']
  return clean(s)
}

function canon_iface(iface: Interface | undefined): JsonObject | undefined {
  if (!iface) return undefined
  // `services` is diffed per service by service_list_changes rather than as one
  // field of the interface, so it is dropped here to avoid reporting it twice.
  const { ssids, services, ...rest } = iface
  const stripped = strip(rest as JsonValue, def_get('interface'))
  const s: JsonObject = stripped && typeof stripped === 'object' && !Array.isArray(stripped) ? stripped : {}
  const def = iface.role === 'downstream' ? 'static' : 'dynamic'
  for (const key of ['ipv4', 'ipv6']) {
    const v = s[key]
    if (v && typeof v === 'object' && !Array.isArray(v) && v.addressing === def) delete v.addressing
  }
  const ipv6 = s.ipv6
  const dhcpv6 = ipv6 && typeof ipv6 === 'object' && !Array.isArray(ipv6) ? ipv6.dhcpv6 : undefined
  if (dhcpv6 && typeof dhcpv6 === 'object' && !Array.isArray(dhcpv6)) {
    if (dhcpv6.mode === 'hybrid') delete dhcpv6.mode
    if (ipv6 && typeof ipv6 === 'object' && !Array.isArray(ipv6) && !Object.keys(dhcpv6).length) delete ipv6.dhcpv6
  }
  for (const key of ['ipv4', 'ipv6']) {
    const v = s[key]
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete s[key]
  }
  return clean(s)
}

function canon_ssid(ssid: Interface4 | undefined): JsonObject | undefined {
  const s = strip(ssid as JsonValue, def_get('interface.ssid'))
  if (!s || typeof s !== 'object' || Array.isArray(s)) return undefined
  const template = s.template
  if (template && typeof template === 'object' && !Array.isArray(template)) {
    if (template.mode === 'encrypted') delete template.mode
    if (template.security === 'maximum') delete template.security
    if (!Object.keys(template).length) delete s.template
  }
  return clean(s)
}

// Which networks offer a service is the service's setting rather than the
// interface's: it is written from the service's page, and it is what actually
// starts the service. Scoped to the service so that page can show and reset it,
// one entry per service that moved rather than one for the array.
function service_list_changes(
  iface: string,
  cur: Interface | undefined,
  base: Interface | undefined
): ChangeEntry[] {
  const now = new Set(Array.isArray(cur?.services) ? (cur.services as string[]) : [])
  const was = new Set(Array.isArray(base?.services) ? (base.services as string[]) : [])
  const out: ChangeEntry[] = []
  for (const name of [...new Set([...now, ...was])].sort()) {
    if (now.has(name) === was.has(name)) continue
    out.push({
      doc: MAIN,
      section: 'Services',
      scope: `service:${name}`,
      kind: 'field',
      key: `services/${iface}/${name}`,
      label: now.has(name)
        ? t("Offered ''{name}'' on {iface}", { name: title_for(name), iface })
        : t("Stopped offering ''{name}'' on {iface}", { name: title_for(name), iface })
    })
  }
  return out
}

function eq(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function keys_union(
  a: Record<string, unknown> | undefined | null,
  b: Record<string, unknown> | undefined | null
): string[] {
  return [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort()
}

// Nested blocks reported as a single entry rather than per leaf, so that one
// addressing edit reads "Changed IPv4 on interface 'lan'" instead of listing
// every field inside it.
const GROUPED = new Set(['ipv4', 'ipv6', 'template', 'dhcpv6', 'vlan', 'dhcp-pool', 'dhcp-leases'])

const ALWAYS_ON = new Set(SYSTEM_SERVICES.filter((s) => s.always).map((s) => s.config))

export interface ChangeContainer {
  noun: string
  key: string
  sub?: string
}

// The document an entry belongs to: the main config, or one include fragment.
export const MAIN = 'main'

export interface ChangeEntry {
  doc: string
  section: string
  scope: string
  kind: 'field' | 'added' | 'removed'
  key: string
  label: string
}

interface DiffMeta {
  section: string
  scope: string
  doc?: string
  container?: ChangeContainer
}

// `container` is null for top-level pages, else { noun, key } or
// { noun, key, sub } for a map entry nested inside another (ssids).
function field_label(key: string, container: ChangeContainer | null): string {
  const field = title_for(key)
  if (!container) return t('Changed {field}', { field })
  // ICU treats a single quote as an escape; '' renders one apostrophe.
  if (container.sub != null) {
    return t("Changed {field} on {noun} ''{key}''/''{sub}''", {
      field,
      noun: container.noun,
      key: container.key,
      sub: container.sub
    })
  }
  return t("Changed {field} on {noun} ''{key}''", { field, noun: container.noun, key: container.key })
}

// Walk two canonicalised objects in parallel, emitting one entry per changed
// leaf and one per changed grouped block.
function diff_fields(cur: JsonObject | undefined, base: JsonObject | undefined, meta: DiffMeta): ChangeEntry[] {
  const out: ChangeEntry[] = []
  for (const key of keys_union(cur, base)) {
    const a = cur?.[key]
    const b = base?.[key]
    if (eq(a, b)) continue
    const nested =
      !GROUPED.has(key) &&
      ((a && typeof a === 'object' && !Array.isArray(a)) || (b && typeof b === 'object' && !Array.isArray(b)))
    if (nested) {
      out.push(...diff_fields(a as JsonObject | undefined, b as JsonObject | undefined, meta))
      continue
    }
    out.push({
      doc: meta.doc ?? MAIN,
      section: meta.section,
      scope: meta.scope,
      kind: 'field',
      key,
      label: field_label(key, meta.container ?? null)
    })
  }
  return out
}

function container_entry(meta: DiffMeta, noun: string, key: string, added: boolean): ChangeEntry {
  return {
    doc: meta.doc ?? MAIN,
    section: meta.section,
    scope: meta.scope,
    kind: added ? 'added' : 'removed',
    key,
    label: added
      ? t('{noun} {key} added', { noun, key })
      : t('{noun} {key} removed', { noun, key })
  }
}

// Each entry carries a `scope`: the nav section that owns it, so a page can
// show and reset only its own changes. Scopes match the keys used by
// `view.section` ('unit', 'radios', 'interfaces', 'service:<key>').
export function changes_list(cur: UconfigDocument | null | undefined, base: UconfigDocument | null | undefined): ChangeEntry[] {
  if (!cur || !base) return []
  const out: ChangeEntry[] = []

  const unit = diff_fields(
    canon_unit(cur.unit) as JsonObject | undefined,
    canon_unit(base.unit) as JsonObject | undefined,
    { section: 'Unit', scope: 'unit' }
  )
  // The timezone is set beside the NTP servers on System > Time rather than
  // beside the hostname, so it carries that page's scope: grouping and reset
  // follow the page that owns a field, not the block it happens to live in.
  for (const c of unit) if (c.key === 'timezone') c.scope = 'time'
  out.push(...unit)

  const radioMeta = { section: 'Radios', scope: 'radios' }
  for (const band of keys_union(cur.radios, base.radios)) {
    const inCur = cur.radios?.[band] != null
    const inBase = base.radios?.[band] != null
    if (inCur !== inBase) {
      out.push(container_entry(radioMeta, t('Radio'), title_for(band), inCur))
      continue
    }
    out.push(
      ...diff_fields(canon_radio(cur.radios?.[band], band), canon_radio(base.radios?.[band], band), {
        ...radioMeta,
        container: { noun: t('radio'), key: title_for(band) }
      })
    )
  }

  // One scope per interface, and a separate one per SSID, so a page that owns a
  // single network can show and reset only its own edits. An interface appearing
  // or disappearing is attributed to the interface rather than to the map, so
  // adding a guest network resets from the Guest page.
  for (const name of keys_union(cur.interfaces, base.interfaces)) {
    const ci = cur.interfaces?.[name]
    const bi = base.interfaces?.[name]
    const ifaceMeta = { section: 'Interfaces', scope: `interface:${name}` }
    if ((ci != null) !== (bi != null)) {
      out.push(container_entry(ifaceMeta, t('Interface'), name, ci != null))
      continue
    }
    out.push(...service_list_changes(name, ci, bi))
    out.push(
      ...diff_fields(canon_iface(ci), canon_iface(bi), {
        ...ifaceMeta,
        container: { noun: t('interface'), key: name }
      })
    )
    for (const ssid of keys_union(ci?.ssids, bi?.ssids)) {
      const cs = ci?.ssids?.[ssid]
      const bs = bi?.ssids?.[ssid]
      // The SSID is what a wireless page edits, so it is tracked apart from the
      // interface that carries it.
      const ssidMeta = { section: 'Interfaces', scope: `ssid:${name}/${ssid}` }
      if ((cs != null) !== (bs != null)) {
        out.push(container_entry(ssidMeta, t('SSID'), `${name}/${ssid}`, cs != null))
        continue
      }
      out.push(
        ...diff_fields(canon_ssid(cs), canon_ssid(bs), {
          ...ssidMeta,
          container: { noun: t('interface'), key: name, sub: ssid }
        })
      )
    }
  }

  // Only ntp-servers is editable so far; the rest of `definitions` is left
  // untracked rather than scoped to a page that cannot reset it.
  if (!eq(strip(cur.definitions?.['ntp-servers']), strip(base.definitions?.['ntp-servers']))) {
    out.push({
      doc: MAIN,
      section: 'Definitions',
      scope: 'ntp',
      kind: 'field',
      key: 'ntp-servers',
      label: field_label('ntp-servers', null)
    })
  }

  const svcDef = def_get('service')
  const svcResolved = svcDef ? ref_resolve(svcDef) : undefined
  const curServices = cur.services as JsonObject | undefined
  const baseServices = base.services as JsonObject | undefined
  for (const svc of keys_union(curServices, baseServices)) {
    const schema = svcResolved?.properties?.[svc] ? ref_resolve(svcResolved.properties[svc]) : undefined
    // A service is enabled by being present, so its whole block appearing or
    // disappearing is one decision, not a list of field edits.
    //
    // Except for one the device runs whatever the config says: it has no on and
    // off, its page materialises a block only to have somewhere to write, and a
    // block holding nothing but schema defaults says what no block says. So its
    // presence is not an edit and only its fields are compared.
    const isOn = curServices?.[svc] !== undefined
    const wasOn = baseServices?.[svc] !== undefined
    if (!ALWAYS_ON.has(svc) && isOn !== wasOn) {
      out.push({
        doc: MAIN,
        section: 'Services',
        scope: `service:${svc}`,
        kind: isOn ? 'added' : 'removed',
        key: svc,
        label: isOn
          ? t("Enabled ''{name}''", { name: title_for(svc) })
          : t("Disabled ''{name}''", { name: title_for(svc) })
      })
      continue
    }
    out.push(
      ...diff_fields(
        strip(curServices?.[svc], schema) as JsonObject | undefined,
        strip(baseServices?.[svc], schema) as JsonObject | undefined,
        {
          section: 'Services',
          scope: `service:${svc}`
        }
      )
    )
  }

  return out
}

export function changes_for(list: ChangeEntry[], scope: string): ChangeEntry[] {
  return list.filter((c) => c.scope === scope)
}

// --- includes ---------------------------------------------------------------

// Where a fragment is pulled into the main document. The device merges the
// snippet into the object carrying the `include` array, and does so before
// validation, so the merged result has to satisfy that object's schema. The
// fragment is therefore schema-shaped; what has to be worked out is which
// position applies, and that comes from the reference site rather than from the
// fragment's own file root.
export interface IncludeMount {
  source: string
  path: string | null
  schema: JsonSchemaNode | undefined
  canon: 'ssid' | 'iface' | 'radio' | 'unit' | null
  band?: string
}

// Which canonicaliser suits a mount, chosen by the container it sits in: an
// object inside `ssids` is an SSID however it was spelled.
function canon_kind(container: string | null): IncludeMount['canon'] {
  if (container === 'ssids') return 'ssid'
  if (container === 'interfaces') return 'iface'
  if (container === 'radios') return 'radio'
  if (container === 'unit') return 'unit'
  return null
}

// Walk the document for objects carrying an `include` array, recording the
// schema position each one sits at. Descends exactly as `strip` does, through
// `properties` for named keys and `patternProperties` for map values.
export function include_mounts(doc: UconfigDocument | null | undefined): Record<string, IncludeMount[]> {
  const out: Record<string, IncludeMount[]> = {}
  if (!doc) return out

  const visit = (node: unknown, schema: JsonSchemaNode | undefined, container: string | null, band?: string) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      const items = schema ? ref_resolve(schema).items : undefined
      for (const child of node) visit(child, items, container, band)
      return
    }

    const obj = node as Record<string, unknown>
    const refs = obj.include
    if (Array.isArray(refs)) {
      for (const raw of refs) {
        if (typeof raw !== 'string') continue
        const cut = raw.indexOf('.')
        const source = cut === -1 ? raw : raw.slice(0, cut)
        const path = cut === -1 ? null : raw.slice(cut + 1)
        ;(out[source] ??= []).push({ source, path, schema, canon: canon_kind(container), band })
      }
    }

    const resolved = schema ? ref_resolve(schema) : undefined
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'include' || key === 'includes') continue
      const named = resolved?.properties?.[key]
      const child = named ?? (resolved ? pattern_value_schema(resolved) ?? undefined : undefined)
      // A map value takes its key as the band, which `canon_radio` needs to
      // know which channel width counts as the default.
      const nextBand = named ? band : key
      visit(value, child, named ? key : container, nextBand)
    }
  }

  visit(doc, rootSchema as JsonSchemaNode, null)
  return out
}

// Canonicalise a snippet the way an inline value at the same position would be,
// so a fragment carrying nothing but schema defaults reads as no change.
function canon_at(value: unknown, mount: IncludeMount): JsonObject | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    const s = strip(value as JsonValue, mount.schema)
    return s && typeof s === 'object' && !Array.isArray(s) ? s : undefined
  }
  if (mount.canon === 'ssid') return canon_ssid(value as Interface4)
  if (mount.canon === 'iface') return canon_iface(value as Interface)
  if (mount.canon === 'radio') return canon_radio(value as Radio, mount.band ?? '')
  if (mount.canon === 'unit') {
    const s = canon_unit(value as Unit)
    return s && typeof s === 'object' && !Array.isArray(s) ? s : undefined
  }
  const s = strip(value as JsonValue, mount.schema)
  return s && typeof s === 'object' && !Array.isArray(s) ? s : undefined
}

// Exported so the include resolver reads a reference exactly as the diff does.
export function at_path(fragment: IncludeFragment | undefined, path: string | null): unknown {
  if (!fragment) return undefined
  if (!path) return fragment
  let node: unknown = fragment
  for (const seg of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[seg]
  }
  return node
}

// Every fragment key a mount already accounts for, so what is left over can be
// diffed structurally without double-reporting.
function mounted_keys(mounts: IncludeMount[]): Set<string> {
  const keys = new Set<string>()
  for (const m of mounts) {
    if (!m.path) return new Set<string>() // whole-file mount covers everything
    keys.add(m.path.split('.')[0])
  }
  return keys
}

// One fragment carries every overlay the venue shares, so a top-level key of it
// is the unit a page owns and can reset. Scoping to the fragment instead would
// make resetting a guest VLAN take the rest of the venue's settings with it.
function overlay_meta(name: string, key: string | null): DiffMeta {
  return {
    doc: `include:${name}`,
    section: 'Includes',
    scope: key ? `include:${name}/${key}` : `include:${name}`,
    // Named as it is referenced, so the entry reads as the thing the user set
    // rather than as the file it happens to travel in.
    container: { noun: t('include'), key: key ? `${name}.${key}` : name }
  }
}

function fragment_diff(
  cur: IncludeFragment | undefined,
  base: IncludeFragment | undefined,
  name: string,
  mounts: IncludeMount[]
): ChangeEntry[] {
  const out: ChangeEntry[] = []

  for (const mount of mounts) {
    const meta = overlay_meta(name, mount.path ? mount.path.split('.')[0] : null)
    out.push(...diff_fields(canon_at(at_path(cur, mount.path), mount), canon_at(at_path(base, mount.path), mount), meta))
  }

  // Anything the document does not currently reference has no schema position
  // to canonicalise against, so it is compared structurally. `uuid` is skipped
  // outright: the device re-stamps it on every apply, and it would otherwise
  // report every fragment as changed every time.
  const covered = mounted_keys(mounts)
  if (!mounts.length || covered.size) {
    const at = (o: IncludeFragment | undefined, k: string): JsonObject => ({ [k]: (o ?? {})[k] as JsonValue })
    for (const key of keys_union(cur, base)) {
      if (key === 'uuid' || covered.has(key)) continue
      out.push(...diff_fields(at(cur, key), at(base, key), overlay_meta(name, key)))
    }
  }

  // One overlay referenced twice is still one edit. Keyed by scope as well as
  // field, so two overlays that happen to share a field name both survive.
  const seen = new Set<string>()
  return out.filter((c) => {
    const id = `${c.scope} ${c.key}`
    return !seen.has(id) && seen.add(id)
  })
}

export function include_changes(
  cur: Record<string, IncludeFragment> | null | undefined,
  base: Record<string, IncludeFragment> | null | undefined,
  doc: UconfigDocument | null | undefined
): ChangeEntry[] {
  const mounts = include_mounts(doc)
  const out: ChangeEntry[] = []

  for (const name of keys_union(cur, base)) {
    const c = cur?.[name]
    const b = base?.[name]
    if ((c != null) !== (b != null)) {
      out.push(
        container_entry(
          { doc: `include:${name}`, section: 'Includes', scope: `include:${name}` },
          t('Include'),
          name,
          c != null
        )
      )
      continue
    }
    out.push(...fragment_diff(c, b, name, mounts[name] ?? []))
  }

  return out
}
