// Reading an interface the way the device reads it.

import { include_resolve } from './includes.ts'
import type { Interface } from './types/uconfig'

// VLAN ids the schema accepts (interface.vlan.id), shared by everything that
// offers or checks one.
export const VLAN_MIN = 1
export const VLAN_MAX = 4094

// uconfig deletes a disabled interface from the state before it renders
// anything (normalize_interfaces in templates/toplevel.uc), so a disabled
// interface holds no ports, serves no VLAN and answers nothing. Anything the UI
// derives from the document has to agree, or a switched-off network goes on
// blocking the ports and ids it no longer uses.
export function iface_enabled(iface: { disable?: boolean } | undefined | null): boolean {
  return iface != null && iface.disable !== true
}

// The interface's VLAN id, which may arrive through an include rather than
// sitting in the document.
export function vlan_id(iface: Interface | undefined | null): number | undefined {
  const vlan = include_resolve(iface?.vlan as Record<string, unknown> | undefined)
  const id = vlan?.id
  return typeof id === 'number' ? id : undefined
}
