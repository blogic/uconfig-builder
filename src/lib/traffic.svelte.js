// Cached WAN throughput history so the Traffic page renders the previous
// reading on re-entry while a fresh fetch runs behind it.
//
// The device returns { up, down }, each an array of four series of byte
// deltas per bucket. Buckets are unlabelled: index 0 is oldest, last is
// newest. Slot widths come from uconfig-state, which polls every 10s.

import { request } from './connection.svelte.js'

export const RESOLUTIONS = [
  { key: 'live', index: 0, buckets: 12, slot: 10, label: 'Live' },
  { key: 'hour', index: 1, buckets: 60, slot: 60, label: 'Hour' },
  { key: 'day', index: 2, buckets: 24, slot: 3600, label: 'Day' },
  { key: 'week', index: 3, buckets: 7, slot: 86400, label: 'Week' }
]

// Gauge full scale, until the WAN link speed is plumbed through.
export const LINK_BITS = 1e9

export const traffic = $state({ data: null, error: null, loading: false })

export async function traffic_refresh() {
  traffic.loading = true
  try {
    traffic.data = (await request('traffic', {})) ?? null
    traffic.error = null
  } catch (e) {
    traffic.error = e?.message || String(e)
  } finally {
    traffic.loading = false
  }
}

export function traffic_clear() {
  traffic.data = null
  traffic.error = null
  traffic.loading = false
}

function series(dir, index) {
  const s = traffic.data?.[dir]?.[index]
  return Array.isArray(s) ? s : []
}

// Bytes per bucket to bits per second at that resolution's slot width.
export function rates(dir, res) {
  return series(dir, res.index).map((b) => ((b ?? 0) * 8) / res.slot)
}

// Newest bucket of the live series: the current throughput.
export function current(dir) {
  const live = RESOLUTIONS[0]
  const s = series(dir, live.index)
  return s.length ? ((s[s.length - 1] ?? 0) * 8) / live.slot : 0
}

export function has_traffic() {
  if (!traffic.data) return false
  for (const dir of ['up', 'down']) {
    for (const res of RESOLUTIONS) {
      if (series(dir, res.index).some((b) => b > 0)) return true
    }
  }
  return false
}

export function bits_format(bps) {
  if (!bps || bps < 1) return { value: '0', unit: 'bit/s' }
  const units = ['bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s']
  let i = 0
  let v = bps
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return { value: v.toFixed(v < 10 && i > 0 ? 1 : 0), unit: units[i] }
}
