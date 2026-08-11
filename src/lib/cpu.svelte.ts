// How hard the device's CPU has been working, over the last ten minutes.
//
// Utilisation, not load average. The device derives each sample from /proc/stat
// jiffy deltas, so a value is the true busy share of its own window: bounded by
// 0 and 100, free of the uninterruptible sleep loadavg folds in, and carrying no
// smoothing between samples. loadavg answers a different question and stays
// where it was, in `system-info`.

import { request } from './connection.svelte.ts'

export interface CpuData {
  // Width of one sample's window, in seconds.
  interval_s: number
  // Capacity of the device's ring, not the current length: `usage` fills up to
  // this after a restart rather than starting padded, so a short array means
  // "not running that long yet" and not "idle".
  samples: number
  // Whole-percent busy time per sample, oldest first, across all cores.
  usage: number[]
}

export const cpu = $state<{ data: CpuData | null; error: string | null }>({
  data: null,
  error: null
})

export async function cpu_refresh() {
  try {
    cpu.data = (await request<CpuData>('cpu', {})) ?? null
    cpu.error = null
  } catch (e) {
    cpu.error = e instanceof Error ? e.message : String(e)
  }
}

export function cpu_clear() {
  cpu.data = null
  cpu.error = null
}

// The newest sample: what the CPU is doing now.
export function cpu_current(): number | null {
  const u = cpu.data?.usage
  return u?.length ? u[u.length - 1] : null
}

// Wall clock the ring covers when full, which is the span the chart draws
// whether or not the device has been up long enough to fill it.
export function cpu_window_s(): number {
  const d = cpu.data
  return d ? d.samples * d.interval_s : 0
}
