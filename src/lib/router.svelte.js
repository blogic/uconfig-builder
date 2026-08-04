// Hash routing so the browser's back and forward buttons move between pages.
//
// Routes are `#/<section>/<page>` with an optional third segment for a
// drill-down, e.g. `#/config/interfaces/wan` or `#/config/service/ssh`.

export const route = $state({ path: null })

// A cold load cannot restore a device session: the websocket is gone and the
// document would be blank. Drop any hash left over from the previous visit at
// import time, before the app reads it, so a reload starts at the beginning.
if (globalThis.location?.hash) {
  history.replaceState(null, '', location.pathname + location.search)
}

function encode(r) {
  if (!r.section) return null
  if (r.section === 'config') {
    if (r.page === 'interfaces' && r.openInterface)
      return `#/config/interfaces/${encodeURIComponent(r.openInterface)}`
    if (r.page?.startsWith('service:')) return `#/config/service/${r.page.slice(8)}`
  }
  return `#/${r.section}/${r.page ?? ''}`.replace(/\/$/, '')
}

// Returns { section, page, openInterface? } or null.
export function route_parse(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!parts.length) return null

  const section = parts[0]
  if (section === 'config' && parts[1] === 'interfaces' && parts[2])
    return { section, page: 'interfaces', openInterface: decodeURIComponent(parts[2]) }
  if (section === 'config' && parts[1] === 'service' && parts[2])
    return { section, page: `service:${parts[2]}` }

  return { section, page: parts[1] ?? null, openInterface: null }
}

// The first entry of a session is pushed rather than replaced, leaving the
// pre-session entry behind it. Backing onto that entry is what signals an
// attempt to leave, which the app turns into a logout prompt.
export function route_sync(current) {
  const next = encode(current)
  if (next == null || next === route.path) return
  route.path = next
  history.pushState(null, '', next)
}

export function route_clear() {
  route.path = null
  history.replaceState(null, '', location.pathname + location.search)
}
