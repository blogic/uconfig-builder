// Cached result of the last `system-info` call so the State page can show the
// previous reading immediately on re-entry while a fresh fetch runs behind it.

import { request, connection } from './connection.svelte.ts'
import type { UcoordStatus } from './ucoord.svelte.ts'

export interface SysInfo {
  localtime: number
  uptime: number
  load: number[]
  memory: {
    total: number
    free: number
    shared: number
    buffered: number
    available: number
    cached: number
  }
  root: {
    total: number
    free: number
    used: number
  }
  tmp?: {
    total: number
    free: number
    used: number
  }
}

// Board identity, from the coordination daemon's peer record. It only changes
// across a firmware upgrade, so it is fetched once rather than polled with the
// rest of the state.
export interface Board {
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

export const sysinfo = $state<{
  data: SysInfo | null
  board: Board | null
  error: string | null
  loading: boolean
}>({ data: null, board: null, error: null, loading: false })

export async function sysinfo_refresh() {
  sysinfo.loading = true
  try {
    sysinfo.data = (await request<SysInfo>('system-info', {})) ?? null
    sysinfo.error = null
  } catch (e) {
    sysinfo.error = e instanceof Error ? e.message : String(e)
  } finally {
    sysinfo.loading = false
  }
  // Only on the first pass: the board record cannot change without a reboot.
  if (!sysinfo.board) await board_refresh()
}

// The board record lives on the managed peer in the daemon's status reply.
export async function board_refresh() {
  const target = connection.device
  if (!target) return
  try {
    const status = await request<UcoordStatus>('status', {})
    sysinfo.board = status?.venues?.[target.venue]?.[target.peer]?.board ?? null
  } catch {
    /* the page falls back to what system-info alone provides */
  }
}

export function sysinfo_clear() {
  sysinfo.data = null
  sysinfo.board = null
  sysinfo.error = null
  sysinfo.loading = false
}
