// Central data loading for the live-device pages.
//
// Each page used to fetch on mount, so arriving at Clients or Traffic meant
// waiting for a round trip. Instead the whole set is seeded once at login and
// then kept fresh by a single set of timers, so every page renders immediately
// from the store it already has.

import { devices_refresh, devices_clear } from './devices.svelte.js'
import { sysinfo_refresh, sysinfo_clear } from './sysinfo.svelte.js'
import { traffic_refresh, traffic_clear } from './traffic.svelte.js'

// Interval matches how fast the underlying data actually changes: the device
// samples traffic every 10s, so polling it faster only re-reads the same
// buckets.
const FEEDS = [
  { key: 'clients', label: 'Clients', refresh: devices_refresh, clear: devices_clear, every: 5000 },
  { key: 'state', label: 'System state', refresh: sysinfo_refresh, clear: sysinfo_clear, every: 5000 },
  { key: 'traffic', label: 'Traffic', refresh: traffic_refresh, clear: traffic_clear, every: 10000 }
]

export const loading = $state({ active: false, done: 0, total: FEEDS.length, label: null })

let timers = []

// Fetch every feed once. Failures are tolerated: a page that has no data shows
// its own error, which beats blocking the whole UI on one slow call.
export async function preload() {
  loading.active = true
  loading.done = 0
  loading.total = FEEDS.length
  loading.label = null

  await Promise.all(
    FEEDS.map(async (f) => {
      loading.label = f.label
      try {
        await f.refresh()
      } catch {
        /* the page renders its own error state */
      }
      loading.done++
    })
  )

  loading.active = false
  loading.label = null
}

export function polling_start() {
  polling_stop()
  timers = FEEDS.map((f) => setInterval(f.refresh, f.every))
}

export function polling_stop() {
  for (const t of timers) clearInterval(t)
  timers = []
}

export function poll_clear() {
  polling_stop()
  for (const f of FEEDS) f.clear()
  loading.active = false
  loading.done = 0
  loading.label = null
}
