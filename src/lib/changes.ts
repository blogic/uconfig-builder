import { ref_resolve, def_get, title_for } from './schema'
import type { JsonSchemaNode } from './schema'
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
  const { ssids, ...rest } = iface
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

export interface ChangeContainer {
  noun: string
  key: string
  sub?: string
}

export interface ChangeEntry {
  section: string
  scope: string
  kind: 'field' | 'added' | 'removed'
  key: string
  label: string
}

interface DiffMeta {
  section: string
  scope: string
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

  out.push(
    ...diff_fields(canon_unit(cur.unit) as JsonObject | undefined, canon_unit(base.unit) as JsonObject | undefined, {
      section: 'Unit',
      scope: 'unit'
    })
  )

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

  const ifaceMeta = { section: 'Interfaces', scope: 'interfaces' }
  for (const name of keys_union(cur.interfaces, base.interfaces)) {
    const ci = cur.interfaces?.[name]
    const bi = base.interfaces?.[name]
    if ((ci != null) !== (bi != null)) {
      out.push(container_entry(ifaceMeta, t('Interface'), name, ci != null))
      continue
    }
    out.push(
      ...diff_fields(canon_iface(ci), canon_iface(bi), {
        ...ifaceMeta,
        container: { noun: t('interface'), key: name }
      })
    )
    for (const ssid of keys_union(ci?.ssids, bi?.ssids)) {
      const cs = ci?.ssids?.[ssid]
      const bs = bi?.ssids?.[ssid]
      if ((cs != null) !== (bs != null)) {
        out.push(container_entry(ifaceMeta, t('SSID'), `${name}/${ssid}`, cs != null))
        continue
      }
      out.push(
        ...diff_fields(canon_ssid(cs), canon_ssid(bs), {
          ...ifaceMeta,
          container: { noun: t('interface'), key: name, sub: ssid }
        })
      )
    }
  }

  // Only ntp-servers is editable so far; the rest of `definitions` is left
  // untracked rather than scoped to a page that cannot reset it.
  if (!eq(strip(cur.definitions?.['ntp-servers']), strip(base.definitions?.['ntp-servers']))) {
    out.push({
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
