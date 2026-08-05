import type { DeviceEntry } from './devices.svelte'

// Bootstrap Icons per fingerprinted device class. The device reports `Printer`
// capitalised and the rest lowercase, so keys are matched case-insensitively.
const CLASS_ICONS: Record<string, string> = {
  phone: 'bi-phone',
  laptop: 'bi-laptop',
  desktop: 'bi-pc-display',
  tablet: 'bi-tablet',
  tv: 'bi-tv',
  speaker: 'bi-speaker',
  'game-console': 'bi-controller',
  printer: 'bi-printer',
  'home-automation-hub': 'bi-house-gear',
  camera: 'bi-camera-video',
  router: 'bi-router',
  watch: 'bi-smartwatch',
  nas: 'bi-hdd-stack'
}

export function device_icon(device: DeviceEntry | undefined): string {
  const cls = device?.fingerprint?.class
  if (!cls) return 'bi-hdd-network'
  return CLASS_ICONS[String(cls).toLowerCase()] ?? 'bi-hdd-network'
}

export function bytes_format(b: number): string {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export function uptime_format(s: number | null | undefined): string {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const parts = []
  if (d) parts.push(`${d}d`)
  if (d || h) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

// Coarse age of a UNIX timestamp. ucoord peer timestamps can be days old while
// the peer is perfectly healthy, so granularity below a minute is noise.
export function ts_relative(ts: number | null | undefined): string {
  if (!ts) return '—'
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Signal bands follow the usual WiFi rule of thumb: -60 and better is strong,
// -75 and better is usable, below that is weak.
export function signal_class(dbm: number | null | undefined): string {
  if (dbm == null) return 'text-zinc-400'
  if (dbm >= -60) return 'text-emerald-600'
  if (dbm >= -75) return 'text-amber-600'
  return 'text-red-600'
}

export function device_name(d: DeviceEntry): string {
  return (
    d.hostname || d.fingerprint?.device_name || d.fingerprint?.device || d.fingerprint?.vendor || d.mac
  )
}

export function device_ip(d: DeviceEntry): string {
  return d.ipv4 || d.ipv6?.[0] || ''
}

// nl80211 reports the negotiated PHY rate in bits per second.
export function rate_format(bps: number | null | undefined): string | null {
  if (!bps) return null
  const mbit = bps / 1e6
  return `${mbit >= 100 ? Math.round(mbit) : mbit.toFixed(1)} Mbit/s`
}

export interface DeviceTraffic {
  down?: number
  up?: number
  total?: number
  split: boolean
}

// Prefer the per-station WiFi counters; wired clients only have the total.
export function device_traffic(d: DeviceEntry): DeviceTraffic | null {
  if (d.wifi && (d.wifi.rx_bytes != null || d.wifi.tx_bytes != null)) {
    return { down: d.wifi.rx_bytes ?? 0, up: d.wifi.tx_bytes ?? 0, split: true }
  }
  if (d.bytes != null) return { total: d.bytes, split: false }
  return null
}
