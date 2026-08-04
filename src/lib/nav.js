// Nav entries shared by the desktop sidebar and the mobile bottom bar.
// Bootstrap Icons match the ones the previous builder used per entry.

import { SERVICES } from './services.js'
import { title_for } from './labels.js'

const SERVICE_ICONS = {
  ssh: 'bi-terminal',
  'radius-server': 'bi-shield-lock',
  log: 'bi-journal-text',
  mdns: 'bi-broadcast',
  lldp: 'bi-diagram-3',
  adguardhome: 'bi-shield-slash',
  ieee8021x: 'bi-key',
  'quality-of-service': 'bi-speedometer2',
  tailscale: 'bi-hdd-network'
}

// NTP is not a service block: it lives at definitions.ntp-servers, but the
// previous UI listed it alongside the services, so it shares the group.
const NTP_ENTRY = { key: 'ntp', label: 'NTP', icon: 'bi-clock' }

export const SERVICE_ENTRIES = [
  ...SERVICES.filter((s) => s.config).map((s) => ({
    key: `service:${s.config}`,
    label: title_for(s.config),
    icon: SERVICE_ICONS[s.config] ?? 'bi-gear'
  })),
  NTP_ENTRY
].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))

export const BUILDER_ITEMS = [
  { key: 'unit', label: 'Unit', icon: 'bi-shield-check' },
  { key: 'interfaces', label: 'Interfaces', icon: 'bi-ethernet' },
  { key: 'radios', label: 'Radios', icon: 'bi-broadcast' },
  { key: 'services', label: 'Services', icon: 'bi-hdd-network' },
  { key: 'json', label: 'JSON', icon: 'bi-code-square' }
]

export const DEVICE_ITEMS = [
  { key: 'network', label: 'Network', icon: 'bi-diagram-3' },
  { key: 'traffic', label: 'Traffic', icon: 'bi-graph-up' },
  { key: 'state', label: 'State', icon: 'bi-speedometer2' },
  { key: 'configure', label: 'Configure', icon: 'bi-sliders' },
  { key: 'system', label: 'System', icon: 'bi-gear' }
]
