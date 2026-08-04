// Hash routing so the browser's back and forward buttons move between pages.
//
// Routing state lives in App.svelte across four values; this module serialises
// them to a hash and parses them back. Only the device and builder screens are
// routed: welcome and login are transient and would strand a reload on a
// screen whose websocket no longer exists.

export const route = $state({ path: null })

// A cold load cannot restore a session: the websocket is gone and the document
// would be blank. Drop any hash left over from the previous visit at import
// time, before the app reads it, so a reload always starts at the landing page.
if (globalThis.location?.hash) {
  history.replaceState(null, '', location.pathname + location.search)
}

function encode(r) {
  if (r.screen === 'device') return `#/device/${r.devicePage}`
  if (r.screen !== 'builder') return null
  if (r.section === 'interfaces' && r.openInterface) return `#/config/interfaces/${encodeURIComponent(r.openInterface)}`
  if (r.section?.startsWith('service:')) return `#/config/service/${r.section.slice(8)}`
  return `#/config/${r.section ?? 'unit'}`
}

// Returns { screen, devicePage?, section?, openInterface? } or null.
export function route_parse(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!parts.length) return null

  if (parts[0] === 'device') return { screen: 'device', devicePage: parts[1] || 'network' }

  if (parts[0] !== 'config') return null
  if (parts[1] === 'interfaces' && parts[2])
    return { screen: 'builder', section: 'interfaces', openInterface: decodeURIComponent(parts[2]) }
  if (parts[1] === 'service' && parts[2]) return { screen: 'builder', section: `service:${parts[2]}` }
  return { screen: 'builder', section: parts[1] || 'unit', openInterface: null }
}

// Push when the destination differs, replace when it is the same page, so a
// single logical page never stacks duplicate history entries.
//
// The first entry of a session is pushed rather than replaced, leaving the
// pre-session entry behind it. Backing onto that entry is what signals an
// attempt to leave the session, which the app turns into a logout prompt.
export function route_sync(current) {
  const next = encode(current)
  if (next == null) return
  if (next === route.path) return
  route.path = next
  history.pushState(null, '', next)
}

export function route_clear() {
  route.path = null
  history.replaceState(null, '', location.pathname + location.search)
}
