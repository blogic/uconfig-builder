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

export const events = $state<{ data: EventLogData | null; error: string | null }>({
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

export function events_clear() {
  events.data = null
  events.error = null
}

export function memory_clear() {
  memory.data = null
  memory.error = null
}

// The device returns its ring buffer in slot order, so once it has wrapped the
// array begins in the middle with the oldest entry. Newest first is what the
// page wants anyway.
export function events_recent(data: EventLogData | null): EventEntry[] {
  return [...(data?.log ?? [])].sort((a, b) => b.time - a.time)
}

// Which filter an event belongs under. Anything unrecognised lands in `device`
// rather than nowhere: the vocabulary is open and a dropped event is worse than
// one filed under the wrong heading.
export function event_group(e: EventEntry): 'clients' | 'wireless' | 'device' {
  if (e.object === 'client' || e.object === 'dhcp') return 'clients'
  if (e.object === 'wifi') return 'wireless'
  return 'device'
}
