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

// Pages of the Status section: what the device is doing right now.
export const STATUS_ITEMS = [
  { key: 'clients', label: 'Clients', icon: 'bi-people' },
  { key: 'traffic', label: 'Traffic', icon: 'bi-graph-up' },
  { key: 'state', label: 'State', icon: 'bi-speedometer2' },
  { key: 'ucoord', label: 'ucoord', icon: 'bi-diagram-3' }
]

// Pages of the Configure section. Services expands into SERVICE_ENTRIES.
export const CONFIG_ITEMS = [
  { key: 'unit', label: 'Unit', icon: 'bi-shield-check' },
  { key: 'interfaces', label: 'Interfaces', icon: 'bi-ethernet' },
  { key: 'radios', label: 'Radios', icon: 'bi-broadcast' },
  { key: 'services', label: 'Services', icon: 'bi-hdd-network', group: true },
  { key: 'changes', label: 'Changes', icon: 'bi-exclamation-circle', whenChanges: true },
  { key: 'json', label: 'JSON', icon: 'bi-code-square' }
]

// One concern per page: each is a distinct, irreversible action.
export const SYSTEM_ITEMS = [
  { key: 'reboot', label: 'Reboot', icon: 'bi-arrow-clockwise' },
  { key: 'firmware', label: 'Firmware', icon: 'bi-cpu' },
  { key: 'factory-reset', label: 'Factory Reset', icon: 'bi-exclamation-triangle' }
]

// Top-level sections. `device` marks the ones that need a live connection, so
// the editor build drops them; `desktopOnly` keeps reboot and firmware actions
// off phones, where they are not sensible errands.
export const SECTIONS = [
  { key: 'status', label: 'Status', icon: 'bi-activity', device: true, items: STATUS_ITEMS },
  { key: 'config', label: 'Configure', icon: 'bi-sliders', items: CONFIG_ITEMS, desktopOnly: true },
  { key: 'system', label: 'System', icon: 'bi-wrench', device: true, items: SYSTEM_ITEMS, desktopOnly: true }
]

// Sections available for this build and breakpoint.
export function sections_for(isDevice, isEditor, wide, connected) {
  return SECTIONS.filter((s) => {
    if (s.device && !isDevice) return false
    if (s.device && !connected) return false
    if (!s.device && !isEditor) return false
    if (!wide && s.desktopOnly) return false
    return true
  })
}
