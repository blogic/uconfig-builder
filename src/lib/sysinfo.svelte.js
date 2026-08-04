// Cached result of the last `system-info` call so the State page can show the
// previous reading immediately on re-entry while a fresh fetch runs behind it.

import { request } from './connection.svelte.js'

export const sysinfo = $state({ data: null, error: null, loading: false })

export async function sysinfo_refresh() {
  sysinfo.loading = true
  try {
    sysinfo.data = (await request('system-info', {})) ?? null
    sysinfo.error = null
  } catch (e) {
    sysinfo.error = e?.message || String(e)
  } finally {
    sysinfo.loading = false
  }
}

export function sysinfo_clear() {
  sysinfo.data = null
  sysinfo.error = null
  sysinfo.loading = false
}
