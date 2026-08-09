// Central data loading for the live-device pages.
//
// Each page used to fetch on mount, so arriving at Clients or Traffic meant
// waiting for a round trip. Instead the whole set is seeded once at login and
// then kept fresh by a single set of timers, so every page renders immediately
// from the store it already has.

import { devices_refresh, devices_clear } from './devices.svelte.ts'
import {
  events_refresh,
  events_clear,
  memory_refresh,
  memory_clear
} from './diagnostics.svelte.ts'
import {
  network_refresh,
  network_clear,
  ports_refresh,
  ports_clear,
  radios_refresh,
  radios_clear
} from './netstate.svelte.ts'
import { sysinfo_refresh, sysinfo_clear } from './sysinfo.svelte.ts'
import { traffic_refresh, traffic_clear } from './traffic.svelte.ts'
import { ucoord_refresh, ucoord_clear } from './ucoord.svelte.ts'

// Interval matches how fast the underlying data actually changes: the device
// samples traffic every 10s, so polling it faster only re-reads the same
// buckets.
const FEEDS = [
  { key: 'clients', refresh: devices_refresh, clear: devices_clear, every: 5000 },
  { key: 'state', refresh: sysinfo_refresh, clear: sysinfo_clear, every: 5000 },
  { key: 'traffic', refresh: traffic_refresh, clear: traffic_clear, every: 10000 },
  // Device state. Addresses and link state change on an event rather than
  // continuously, so these are slower than the client list; a radio's airtime
  // moves constantly but nobody watches it by the second.
  { key: 'network', refresh: network_refresh, clear: network_clear, every: 10000 },
  { key: 'ports', refresh: ports_refresh, clear: ports_clear, every: 10000 },
  { key: 'radios', refresh: radios_refresh, clear: radios_clear, every: 10000 },
  { key: 'events', refresh: events_refresh, clear: events_clear, every: 10000 },
  // Only the free-memory half of this is live. The per-process figures come
  // from a table the device resamples once an hour, so polling any faster would
  // redraw a frozen list beside a moving gauge.
  { key: 'memory', refresh: memory_refresh, clear: memory_clear, every: 60000 },
  // Peer entries only change on a state transition, so this is near-static; the
  // cost is one status call plus an info call per connected peer.
  { key: 'ucoord', refresh: ucoord_refresh, clear: ucoord_clear, every: 10000 }
]

export const loading = $state({ active: false, done: 0, total: FEEDS.length })

let timers: ReturnType<typeof setInterval>[] = []

// Fetch every feed once. Failures are tolerated: a page that has no data shows
// its own error, which beats blocking the whole UI on one slow call.
export async function preload() {
  loading.active = true
  loading.done = 0
  loading.total = FEEDS.length

  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        await f.refresh()
      } catch {
        /* the page renders its own error state */
      }
      loading.done++
    })
  )

  loading.active = false
}

// Poll one feed while its page is open: refresh immediately on arrival, then
// on an interval, and stop on leave. Returns a teardown for $effect.
export function poll_feed(key: string): () => void {
  const feed = FEEDS.find((f) => f.key === key)
  if (!feed) return () => {}

  feed.refresh()
  const iv = setInterval(feed.refresh, feed.every)
  timers.push(iv)

  return () => {
    clearInterval(iv)
    timers = timers.filter((t) => t !== iv)
  }
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
}
