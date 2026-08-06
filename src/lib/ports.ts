// Static port capabilities until real device detection is added: 1 WAN + 4 LAN.
export const PORT_CAPS = ['wan', 'lan1', 'lan2', 'lan3', 'lan4']

// Which physical ports a port key covers. Wildcards (wan*, lan*) cover the whole
// matching group; a discrete key covers just itself. `list` is the active port
// set (device-derived when connected, PORT_CAPS otherwise).
export function port_cover(key: string, list: string[] = PORT_CAPS): string[] {
  if (key.endsWith('*')) {
    const prefix = key.slice(0, -1)
    return list.filter((p) => p.startsWith(prefix))
  }
  return [key]
}

export function is_wildcard(key: string): boolean {
  return key.endsWith('*')
}

// Ports offerable for assignment: the physical ports plus a wildcard per group
// that has more than one member. With a single WAN, `wan*` and `wan` would
// select the same thing, so only the discrete port is offered.
export function port_options(list: string[]): string[] {
  const groups = new Map<string, number>()
  for (const p of list) {
    const prefix = p.replace(/\d+$/, '')
    groups.set(prefix, (groups.get(prefix) ?? 0) + 1)
  }
  const out = [...list]
  for (const [prefix, count] of groups) {
    if (count > 1) out.push(`${prefix}*`)
  }
  return out
}

// Keys that `key` makes redundant: assigning lan* subsumes lan1, lan2 and so
// on, since it already covers every port they do.
export function port_absorbed(key: string, assigned: string[], list: string[]): string[] {
  const cover = new Set(port_cover(key, list))
  return assigned.filter((k) => {
    if (k === key) return false
    const inner = port_cover(k, list)
    return inner.length > 0 && inner.every((p) => cover.has(p))
  })
}

// Without a VLAN the render pipeline ignores tagging, so a port is always an
// untagged access port. With a VLAN, "auto" tags on upstream and leaves
// untagged on downstream; explicit modes are used as-is.
export function effective_tag(mode: string, role: string | undefined, hasVlan: boolean): string {
  if (!hasVlan) return 'un-tagged'
  if (mode === 'auto') return role === 'upstream' ? 'tagged' : 'un-tagged'
  return mode
}
