// Venue and peer state from the coordination daemon.
//
// `status` returns every venue with its peers, so this is the one view in the
// app that sees past the single managed device. It carries no uptime or memory,
// so each connected peer is asked for `info` alongside it.

import { request, connection } from './connection.svelte.ts'
import type { SysInfo } from './sysinfo.svelte.ts'

export interface UcoordPeer {
  state: string
  ts: number
  capabilities?: {
    compatible?: string
    model?: string
    network?: {
      lan?: string[]
      wan?: string[]
    }
  }
  board?: {
    kernel?: string
    hostname?: string
    system?: string
    model?: string
    board_name?: string
    rootfs_type?: string
    release?: {
      distribution?: string
      version?: string
      revision?: string
      target?: string
      description?: string
      builddate?: string
    }
  }
  includes?: Record<string, string>
  local_macs?: string[] | null
}

export interface UcoordStatus {
  venues: Record<string, Record<string, UcoordPeer>>
}

// Same shape as `system-info`: each connected peer is asked for `info` in
// addition to `status`, which the managed device also gets via `system-info`.
export type PeerInfo = SysInfo

export const ucoord = $state<{
  venues: UcoordStatus['venues'] | null
  info: Record<string, PeerInfo>
  error: string | null
  loading: boolean
}>({ venues: null, info: {}, error: null, loading: false })

// `info` is addressed by venue and peer, which request() would otherwise fill in
// from the managed target -- pass them explicitly to reach the other peers.
async function peer_info(venue: string, peer: string): Promise<PeerInfo | null> {
  try {
    return await request<PeerInfo>('info', { venue, peer, timeout: 4000 })
  } catch {
    return null
  }
}

export async function ucoord_refresh() {
  ucoord.loading = true
  try {
    const status = await request<UcoordStatus>('status', {})
    const venues = status?.venues ?? {}

    const wanted: [string, string][] = []
    for (const [venue, peers] of Object.entries(venues)) {
      for (const [peer, info] of Object.entries(peers ?? {})) {
        if (info?.state === 'connected') wanted.push([venue, peer])
      }
    }

    const results = await Promise.all(wanted.map(([v, p]) => peer_info(v, p)))
    const info: Record<string, PeerInfo> = {}
    wanted.forEach(([v, p], i) => {
      const r = results[i]
      if (r) info[`${v}/${p}`] = r
    })

    ucoord.venues = venues
    ucoord.info = info
    ucoord.error = null
  } catch (e) {
    ucoord.error = e instanceof Error ? e.message : String(e)
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
export function is_managed(venue: string, peer: string): boolean {
  return connection.device?.venue === venue && connection.device?.peer === peer
}
