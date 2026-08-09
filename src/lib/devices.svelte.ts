// Cached result of the last `devices` call so the Network page can show data
// immediately on re-entry while a fresh fetch runs in the background.

import { request } from './connection.svelte.ts'

// `online` is absent rather than false on devices only ever seen via ARP.
export interface DeviceEntry {
  mac: string
  hostname?: string
  ipv4?: string
  ipv6?: string[]
  online?: boolean
  bytes?: number
  fingerprint?: {
    class?: string
    device?: string
    device_name?: string
    vendor?: string
  }
  wifi?: {
    band?: string
    ssid?: string
    host?: string
    signal?: number
    rx_rate?: number
    tx_rate?: number
    mode?: string
    rx_bytes?: number
    tx_bytes?: number
  }
}

export type DevicesData = Record<string, Record<string, DeviceEntry>>

export const deviceStore = $state<{
  data: DevicesData | null
  error: string | null
  loading: boolean
}>({ data: null, error: null, loading: false })

// Every client across every network, one flat list.
//
// The map key fills in as the mac when an entry does not carry one, and both
// levels tolerate a null: a real device returns a network whose value is null,
// and `Object.values(null)` throws rather than yielding nothing. Four pages
// walked this by hand and three of them crashed the first time a device did it.
export function clients_all(data: DevicesData | null): DeviceEntry[] {
  const out: DeviceEntry[] = []
  for (const macs of Object.values(data ?? {})) {
    for (const [mac, dev] of Object.entries(macs ?? {})) {
      if (dev) out.push({ ...dev, mac: dev.mac || mac })
    }
  }
  return out
}

export async function devices_refresh() {
  deviceStore.loading = true
  try {
    deviceStore.data = (await request<DevicesData>('devices', {})) ?? {}
    deviceStore.error = null
  } catch (e) {
    deviceStore.error = e instanceof Error ? e.message : String(e)
  } finally {
    deviceStore.loading = false
  }
}

export function devices_clear() {
  deviceStore.data = null
  deviceStore.error = null
  deviceStore.loading = false
}
