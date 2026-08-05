// Venue and peer state from the coordination daemon.
//
// `status` returns every venue with its peers, so this is the one view in the
// app that sees past the single managed device. It carries no uptime or memory,
// so each connected peer is asked for `info` alongside it.

import { request, connection } from './connection.svelte.js'

export const ucoord = $state({ venues: null, info: {}, error: null, loading: false })

// `info` is addressed by venue and peer, which request() would otherwise fill in
// from the managed target -- pass them explicitly to reach the other peers.
async function peer_info(venue, peer) {
  try {
    return await request('info', { venue, peer, timeout: 4000 })
  } catch {
    return null
  }
}

export async function ucoord_refresh() {
  ucoord.loading = true
  try {
    const status = await request('status', {})
    const venues = status?.venues ?? {}

    const wanted = []
    for (const [venue, peers] of Object.entries(venues)) {
      for (const [peer, info] of Object.entries(peers ?? {})) {
        if (info?.state === 'connected') wanted.push([venue, peer])
      }
    }

    const results = await Promise.all(wanted.map(([v, p]) => peer_info(v, p)))
    const info = {}
    wanted.forEach(([v, p], i) => {
      if (results[i]) info[`${v}/${p}`] = results[i]
    })

    ucoord.venues = venues
    ucoord.info = info
    ucoord.error = null
  } catch (e) {
    ucoord.error = e?.message || String(e)
  } finally {
    ucoord.loading = false
  }
}

export function ucoord_clear() {
  ucoord.venues = null
  ucoord.info = {}
  ucoord.error = null
  ucoord.loading = false
}

// The peer the rest of the app is configuring; the others are shown read-only.
export function is_managed(venue, peer) {
  return connection.device?.venue === venue && connection.device?.peer === peer
}
