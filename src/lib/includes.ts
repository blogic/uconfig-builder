// The one shared include.
//
// An overlay is a piece of configuration that should be the same on every
// device in a venue rather than particular to this one. ucoord already syncs
// whole files across a venue, so a file per overlay would be several things to
// keep in step instead of one: every overlay lives in a single fragment, keyed
// by what it configures.
//
// The alias and the file name are deliberately the same string. The device
// splits a reference on its first dot and looks the leading part up in the
// document's top-level `includes` map, which resolves to a file; `include_mounts`
// in changes.ts reads that same leading part as a key into `store.includes`,
// which is keyed by file name. Equal names keep both readings true.

import { store } from './store.svelte.ts'
import { at_path } from './changes.ts'

export const INCLUDE_NAME = 'my-network'

// `ucoord:` resolves to /etc/ucoord/configs/<name>.json, the directory ucoord
// syncs across the venue. `local:` would be this device only, which is the one
// thing an overlay must not be.
export const INCLUDE_SOURCE = `ucoord:${INCLUDE_NAME}`

export const GUEST_VLAN_KEY = 'guest-vlan'

export function overlay_ref(key: string): string {
  return `${INCLUDE_NAME}.${key}`
}

// `includes` is not in the schema: uconfig resolves and then strips it, along
// with every `include` array, before validating. So it is written through a cast
// and never appears in the generated types.
export function include_declare(doc: Record<string, unknown>) {
  if (!doc.includes || typeof doc.includes !== 'object') doc.includes = {}
  const map = doc.includes as Record<string, unknown>
  if (map[INCLUDE_NAME] !== INCLUDE_SOURCE) map[INCLUDE_NAME] = INCLUDE_SOURCE
}

// Point an object at an overlay. The object keeps whatever it already had; the
// fragment supplies the rest when the device merges it.
export function ref_attach(obj: Record<string, unknown>, key: string) {
  const ref = overlay_ref(key)
  const refs = Array.isArray(obj.include) ? (obj.include as string[]) : []
  if (!refs.includes(ref)) obj.include = [...refs, ref]
}

export function include_ensure() {
  if (!store.includes[INCLUDE_NAME]) store.includes[INCLUDE_NAME] = {}
  include_declare(store.doc as unknown as Record<string, unknown>)
}

export function overlay_get(key: string): Record<string, unknown> | undefined {
  const value = store.includes[INCLUDE_NAME]?.[key]
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

export function overlay_set(key: string, value: unknown) {
  include_ensure()
  ;(store.includes[INCLUDE_NAME] as Record<string, unknown>)[key] = value
}

// Objects merge recursively; scalars and arrays from the fragment overwrite.
// Mirrors deep_merge in uconfig's includes.uc, including that the fragment wins.
function deep_merge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target }
  for (const [k, v] of Object.entries(source)) {
    const cur = out[k]
    const both_objects =
      v != null && typeof v === 'object' && !Array.isArray(v) && cur != null && typeof cur === 'object' && !Array.isArray(cur)
    out[k] = both_objects
      ? deep_merge(cur as Record<string, unknown>, v as Record<string, unknown>)
      : v
  }
  return out
}

// A read-only view of an object with its references merged in, for the pages
// that have to reason about a value the document itself only points at. The
// document keeps carrying the reference; nothing here writes back.
export function include_resolve<T extends Record<string, unknown>>(obj: T | undefined): T | undefined {
  if (!obj) return obj
  const refs = obj.include
  if (!Array.isArray(refs)) return obj
  let out: Record<string, unknown> = { ...obj }
  delete out.include
  for (const raw of refs) {
    if (typeof raw !== 'string') continue
    const cut = raw.indexOf('.')
    const source = cut === -1 ? raw : raw.slice(0, cut)
    const path = cut === -1 ? null : raw.slice(cut + 1)
    const snippet = at_path(store.includes[source], path)
    if (snippet && typeof snippet === 'object' && !Array.isArray(snippet)) {
      out = deep_merge(out, snippet as Record<string, unknown>)
    }
  }
  return out as T
}
