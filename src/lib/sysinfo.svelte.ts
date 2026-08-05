// Cached result of the last `system-info` call so the State page can show the
// previous reading immediately on re-entry while a fresh fetch runs behind it.

import { request } from './connection.svelte.ts'

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

export const sysinfo = $state<{
  data: SysInfo | null
  error: string | null
  loading: boolean
}>({ data: null, error: null, loading: false })

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
}

export function sysinfo_clear() {
  sysinfo.data = null
  sysinfo.error = null
  sysinfo.loading = false
}
