// What the device is doing, as opposed to what it was told to do.
//
// Three calls, kept apart because they change at different rates and no page
// wants all three: radios and ports are hardware readings, `network` is what
// the uplink and the local network were actually given. See
// docs/device-state.md for the payloads and where the device gets them.

import { request } from './connection.svelte.ts'

export interface RadioState {
  // What the config asked for, "0" meaning auto, against what the radio picked.
  channel?: string
  active_channel?: string
  htmode?: string
  mode?: string
  bandwidth?: string
  freq?: number
  // Airtime in use, as a percentage.
  utilization?: number
  bandwidths?: string[]
  channels?: Record<string, string[]>
}

export interface PortState {
  netdev?: string
  index?: number
  carrier?: boolean
  // Null while nothing is plugged in.
  speed?: string | null
  macaddr?: string
  rx_bytes?: number
  tx_bytes?: number
}

export interface AddressState {
  proto?: string
  address?: string
  gateway?: string
  dns?: string[]
  search?: string[]
  lease?: { server?: string; time?: number }
  addresses?: string[]
  // The prefix delegated to us, and what we handed on.
  prefix?: string
  assigned?: string[]
}

export interface InterfaceState {
  up?: boolean
  uptime?: number
  device?: string
  ipv4?: AddressState
  ipv6?: AddressState
}

export type RadiosData = Record<string, RadioState>
export type PortsData = Record<string, PortState>
export type NetworkData = Record<string, InterfaceState>

export const radios = $state<{ data: RadiosData | null; error: string | null }>({
  data: null,
  error: null
})

export const ports = $state<{ data: PortsData | null; error: string | null }>({
  data: null,
  error: null
})

export const network = $state<{ data: NetworkData | null; error: string | null }>({
  data: null,
  error: null
})

export async function radios_refresh() {
  try {
    radios.data = (await request<RadiosData>('radios', {})) ?? {}
    radios.error = null
  } catch (e) {
    radios.error = e instanceof Error ? e.message : String(e)
  }
}

export async function ports_refresh() {
  try {
    ports.data = (await request<PortsData>('ports', {})) ?? {}
    ports.error = null
  } catch (e) {
    ports.error = e instanceof Error ? e.message : String(e)
  }
}

export async function network_refresh() {
  try {
    network.data = (await request<NetworkData>('network', {})) ?? {}
    network.error = null
  } catch (e) {
    network.error = e instanceof Error ? e.message : String(e)
  }
}

export function radios_clear() {
  radios.data = null
  radios.error = null
}

export function ports_clear() {
  ports.data = null
  ports.error = null
}

export function network_clear() {
  network.data = null
  network.error = null
}

// Protocols that go upstream for their addressing. An interface speaking one of
// these is the uplink whether or not it got an answer.
const UPLINK_PROTOS = new Set(['dhcp', 'pppoe', 'pppoa', 'wwan', 'qmi', 'ncm'])

// The uplink is whichever interface has a gateway: an access point has none, and
// a router may name its uplink something other than `wan`. A gateway alone is
// not enough to go on, though -- an uplink that has lost its lease has none, and
// that is the state these pages exist to explain -- so fall back to the protocol
// and finally to the conventional name.
export function uplink(data: NetworkData | null): [string, InterfaceState] | null {
  const entries = Object.entries(data ?? {})
  return (
    entries.find(([, i]) => i.ipv4?.gateway || i.ipv6?.prefix) ??
    entries.find(([, i]) => UPLINK_PROTOS.has(i.ipv4?.proto ?? '')) ??
    entries.find(([name]) => name === 'wan') ??
    null
  )
}

// Everything that is not the uplink, which is what the wired page reports on.
//
// An access point commonly has exactly one interface, which is both its uplink
// and the network its clients sit on -- a real GL-MT6000 in AP mode reports a
// single `main` on `br-wan0v0` holding the DHCP lease. Subtracting the uplink
// there would leave the page with nothing to show, so a lone interface counts
// as local as well.
export function local(data: NetworkData | null): [string, InterfaceState][] {
  const entries = Object.entries(data ?? {})
  if (entries.length < 2) return entries

  const up = uplink(data)?.[0]
  return entries.filter(([name]) => name !== up)
}

// Sockets in the order they sit on the case, with the uplink kept apart: a WAN
// socket answers a different question from the switch.
export function sorted_ports(data: PortsData | null, wan: boolean): [string, PortState][] {
  return Object.entries(data ?? {})
    .filter(([name]) => name.startsWith('WAN') === wan)
    .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0))
}
