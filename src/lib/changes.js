import { ref_resolve, def_get, title_for } from './schema.js'
import { default_width } from './channels.js'
import { t } from './i18n.svelte.js'

// Reduce a value to a default-stripped, empty-pruned canonical form so that
// defaults the UI materialises while a section is merely viewed do not register
// as edits. Only values the user has actually changed away from their default
// survive.
function strip(value, schema) {
  schema = schema ? ref_resolve(schema) : null
  if (Array.isArray(value)) return value.length ? value : undefined
  if (value && typeof value === 'object') {
    const props = schema?.properties ?? {}
    const ppNode = schema?.patternProperties
    const ppS = ppNode ? ref_resolve(Object.values(ppNode)[0]) : null
    const out = {}
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

function clean(obj) {
  if (!obj) return undefined
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k]
  return Object.keys(obj).length ? obj : undefined
}

function canon_unit(u) {
  return strip(u, def_get('unit'))
}

function canon_radio(r, band) {
  const s = strip(r, def_get('radio'))
  if (!s) return undefined
  if (s.channel === 'auto') delete s.channel
  if (s['tx-power'] === 30) delete s['tx-power']
  if (s['channel-width'] === default_width(band)) delete s['channel-width']
  return clean(s)
}

function canon_iface(iface) {
  if (!iface) return undefined
  const { ssids, ...rest } = iface
  const s = strip(rest, def_get('interface')) ?? {}
  const def = iface.role === 'downstream' ? 'static' : 'dynamic'
  for (const key of ['ipv4', 'ipv6']) {
    if (s[key] && typeof s[key] === 'object' && s[key].addressing === def) delete s[key].addressing
  }
  const dhcpv6 = s.ipv6?.dhcpv6
  if (dhcpv6 && typeof dhcpv6 === 'object') {
    if (dhcpv6.mode === 'hybrid') delete dhcpv6.mode
    if (!Object.keys(dhcpv6).length) delete s.ipv6.dhcpv6
  }
  for (const key of ['ipv4', 'ipv6']) {
    if (s[key] && typeof s[key] === 'object' && !Object.keys(s[key]).length) delete s[key]
  }
  return clean(s)
}

function canon_ssid(ssid) {
  const s = strip(ssid, def_get('interface.ssid'))
  if (!s) return undefined
  if (s.template && typeof s.template === 'object') {
    if (s.template.mode === 'encrypted') delete s.template.mode
    if (s.template.security === 'maximum') delete s.template.security
    if (!Object.keys(s.template).length) delete s.template
  }
  return clean(s)
}

function eq(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function keys_union(a, b) {
  return [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort()
}

// Nested blocks reported as a single entry rather than per leaf, so that one
// addressing edit reads "Changed IPv4 on interface 'lan'" instead of listing
// every field inside it.
const GROUPED = new Set(['ipv4', 'ipv6', 'template', 'dhcpv6', 'vlan', 'dhcp-pool', 'dhcp-leases'])

// `container` is null for top-level pages, else { noun, key } or
// { noun, key, sub } for a map entry nested inside another (ssids).
function field_label(key, container) {
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
function diff_fields(cur, base, meta) {
  const out = []
  for (const key of keys_union(cur, base)) {
    const a = cur?.[key]
    const b = base?.[key]
    if (eq(a, b)) continue
    const nested =
      !GROUPED.has(key) &&
      ((a && typeof a === 'object' && !Array.isArray(a)) || (b && typeof b === 'object' && !Array.isArray(b)))
    if (nested) {
      out.push(...diff_fields(a, b, meta))
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

function container_entry(meta, noun, key, added) {
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
export function changes_list(cur, base) {
  if (!cur || !base) return []
  const out = []

  out.push(
    ...diff_fields(canon_unit(cur.unit), canon_unit(base.unit), { section: 'Unit', scope: 'unit' })
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

  const svcDef = ref_resolve(def_get('service'))
  for (const svc of keys_union(cur.services, base.services)) {
    const schema = svcDef?.properties?.[svc] ? ref_resolve(svcDef.properties[svc]) : null
    out.push(
      ...diff_fields(strip(cur.services?.[svc], schema), strip(base.services?.[svc], schema), {
        section: 'Services',
        scope: `service:${svc}`
      })
    )
  }

  return out
}

export function changes_for(list, scope) {
  return list.filter((c) => c.scope === scope)
}
