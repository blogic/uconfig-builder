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
