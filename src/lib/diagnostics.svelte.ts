// What the device has been doing to itself: its event log, and which of its
// processes are growing.
//
// Kept apart from netstate.svelte.ts, which is about the network. These two
// answer "what happened" and "why is the memory climbing", come from different
// daemons, and change at very different rates. See docs/device-state.md.

import { request } from './connection.svelte.ts'

// `{object, verb, time}` are always there; the rest of the payload is merged in
// flat and differs per verb. The index signature is not laziness: the vocabulary
// is open, since the device's `event` method takes any object and verb from any
// caller and the dhcp verb is whatever dnsmasq emits.
export interface EventEntry {
  object: string
  verb: string
  time: number
  [field: string]: unknown
}

export interface EventLogData {
  log: EventEntry[]
}

export interface ProcessState {
  pid: number
  cmd: string
  // How long umemd has watched it, not how long it has run.
  age_s: number
  rss_kb: number
  rss_startup_kb: number
  rss_delta_kb: number
  fds: number
  fds_startup: number
  fds_delta: number
}

export interface MemoryData {
  system: {
    total_kb: number
    free_kb: number
    available_kb: number
    buff_cache_kb: number
    swap_total_kb: number
    swap_free_kb: number
  }
  // The device's own names. `leaking` means only that the process grew at all,
  // which is why nothing downstream repeats the word.
  leaking: ProcessState[]
  stable: ProcessState[]
}

// The device's two free-text logs. One shape for both: the kernel's monotonic
// stamp is converted to epoch milliseconds on the device, so a single page can
// render them against the same clock. `id` and `source` are syslog's alone.
export interface LogEntry {
  msg: string
  time: number | null
  // syslog facility*8 + severity, which is also what dmesg's <N> prefix holds.
  priority?: number | null
  id?: number
  source?: number
}

export interface LogData {
  log: LogEntry[]
}

export const events = $state<{ data: EventLogData | null; error: string | null }>({
  data: null,
  error: null
})

export const syslog = $state<{ data: LogData | null; error: string | null }>({
  data: null,
  error: null
})

export const dmesg = $state<{ data: LogData | null; error: string | null }>({
  data: null,
  error: null
})

export const memory = $state<{ data: MemoryData | null; error: string | null }>({
  data: null,
  error: null
})

export async function events_refresh() {
  try {
    events.data = (await request<EventLogData>('event-log', {})) ?? { log: [] }
    events.error = null
  } catch (e) {
    events.error = e instanceof Error ? e.message : String(e)
  }
}

export async function memory_refresh() {
  try {
    memory.data = (await request<MemoryData>('memory', {})) ?? null
    memory.error = null
  } catch (e) {
    memory.error = e instanceof Error ? e.message : String(e)
  }
}

export async function syslog_refresh() {
  try {
    syslog.data = (await request<LogData>('syslog', {})) ?? { log: [] }
    syslog.error = null
  } catch (e) {
    syslog.error = e instanceof Error ? e.message : String(e)
  }
}

export async function dmesg_refresh() {
  try {
    dmesg.data = (await request<LogData>('dmesg', {})) ?? { log: [] }
    dmesg.error = null
  } catch (e) {
    dmesg.error = e instanceof Error ? e.message : String(e)
  }
}

export function events_clear() {
  events.data = null
  events.error = null
}

export function syslog_clear() {
  syslog.data = null
  syslog.error = null
}

export function dmesg_clear() {
  dmesg.data = null
  dmesg.error = null
}

export function memory_clear() {
  memory.data = null
  memory.error = null
}

// The device returns its ring buffer in slot order, so once it has wrapped the
// array begins in the middle rather than at the oldest entry. Sorted oldest
// first: the pages read like a terminal, newest at the bottom.
export function events_ordered(data: EventLogData | null): EventEntry[] {
  return [...(data?.log ?? [])].sort((a, b) => a.time - b.time)
}

// Which filter an event belongs under. Anything unrecognised lands in `device`
// rather than nowhere: the vocabulary is open and a dropped event is worse than
// one filed under the wrong heading.
export function event_group(e: EventEntry): 'clients' | 'wireless' | 'device' {
  if (e.object === 'client' || e.object === 'dhcp') return 'clients'
  if (e.object === 'wifi') return 'wireless'
  return 'device'
}

// Oldest first, newest at the bottom. Sorted rather than left as received
// because the two logs come from different daemons and agree only on `time`;
// `id` breaks ties inside syslog, where entries routinely share a millisecond.
export function log_ordered(data: LogData | null): LogEntry[] {
  return [...(data?.log ?? [])].sort(
    (a, b) => (a.time ?? 0) - (b.time ?? 0) || (a.id ?? 0) - (b.id ?? 0)
  )
}

// The low three bits of a syslog priority are the severity; the rest is the
// facility, which says which daemon spoke and not how much it matters.
const SEVERITY = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug']

export function log_severity(priority: number | null | undefined): string | null {
  if (priority == null) return null
  return SEVERITY[priority & 7] ?? null
}
