// Nav entries shared by the desktop sidebar and the mobile bottom bar.
// Bootstrap Icons match the ones the previous builder used per entry.

import { SERVICES, available_services } from './services.ts'
import type { ServiceEntry } from './services.ts'
import { title_for } from './labels.ts'

export interface NavItem {
  key: string
  label: string
  icon: string
  // Services expands into SERVICE_ENTRIES rather than linking to a page of its
  // own, and Changes only appears once there is something to show.
  group?: boolean
  whenChanges?: boolean
}

export interface NavSection {
  key: string
  label: string
  icon: string
  items: NavItem[]
  device?: boolean
  desktopOnly?: boolean
  // Mirrors NavItem.whenChanges: the section is offered only while the document
  // has pending edits.
  whenChanges?: boolean
}

const SERVICE_ICONS: Record<string, string> = {
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

function entries_from(list: ServiceEntry[]): NavItem[] {
  return [
    ...list
      .filter((s) => s.config)
      .map((s) => ({
        key: `service:${s.config}`,
        label: title_for(s.config as string),
        icon: SERVICE_ICONS[s.config as string] ?? 'bi-gear'
      })),
    NTP_ENTRY
  ].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

// Narrowed to the packages a connected device reports; `null` leaves the whole
// set, which is what the offline editor wants.
export function service_entries(modules: string[] | null): NavItem[] {
  return entries_from(available_services(modules))
}

export const SERVICE_ENTRIES: NavItem[] = entries_from(SERVICES)

// Pages of the Status section: what the device is doing right now.
export const STATUS_ITEMS: NavItem[] = [
  { key: 'traffic', label: 'Traffic', icon: 'bi-graph-up' },
  { key: 'clients', label: 'Clients', icon: 'bi-people' }
]

// Pages of the ucoord section: the venue and its peers, rather than this
// device alone.
export const UCOORD_ITEMS: NavItem[] = [{ key: 'overview', label: 'Overview', icon: 'bi-diagram-3' }]

// Pages of the Configure section. Services expands into SERVICE_ENTRIES.
export const CONFIG_ITEMS: NavItem[] = [
  { key: 'unit', label: 'Unit', icon: 'bi-shield-check' },
  { key: 'interfaces', label: 'Interfaces', icon: 'bi-ethernet' },
  { key: 'radios', label: 'Radios', icon: 'bi-broadcast' },
  { key: 'services', label: 'Services', icon: 'bi-hdd-network', group: true },
  { key: 'changes', label: 'Changes', icon: 'bi-exclamation-circle', whenChanges: true },
  { key: 'json', label: 'JSON', icon: 'bi-code-square' }
]

// Pages of the Wireless section: the Wi-Fi networks and the radios they run
// on. `net-radios` rather than `radios` because page keys share one flat
// namespace and `radios` already names the Configure page; `wireless` predates
// the Main label the entry now carries.
export const WIRELESS_ITEMS: NavItem[] = [
  { key: 'wireless', label: 'Main', icon: 'bi-wifi' },
  { key: 'guest', label: 'Guest', icon: 'bi-people' },
  { key: 'net-radios', label: 'Radios', icon: 'bi-broadcast' }
]

// Pages of the Network section: the wired side, uplink and addressing.
export const NETWORK_ITEMS: NavItem[] = [
  { key: 'wan', label: 'WAN', icon: 'bi-globe' },
  { key: 'lan', label: 'LAN', icon: 'bi-ethernet' }
]

// Edits arrive from several sections, so the pending list is a section of its
// own rather than an item inside whichever one happened to own it.
export const CHANGES_ITEMS: NavItem[] = [
  { key: 'changes', label: 'Pending', icon: 'bi-exclamation-circle' }
]

// State reports on the device; the rest are one irreversible action per page.
export const SYSTEM_ITEMS: NavItem[] = [
  { key: 'state', label: 'State', icon: 'bi-speedometer2' },
  { key: 'reboot', label: 'Reboot', icon: 'bi-arrow-clockwise' },
  { key: 'firmware', label: 'Firmware', icon: 'bi-cpu' },
  { key: 'factory-reset', label: 'Factory Reset', icon: 'bi-exclamation-triangle' }
]

// Top-level sections. `device` marks the ones that need a live connection, so
// the editor build drops them; `desktopOnly` keeps reboot and firmware actions
// off phones, where they are not sensible errands.
export const SECTIONS: NavSection[] = [
  { key: 'status', label: 'Status', icon: 'bi-activity', device: true, items: STATUS_ITEMS },
  // Reachable on mobile: it is a read-only view of the venue, not a config
  // errand, and the bottom bar carries it beside the Status pages.
  { key: 'ucoord', label: 'uCoord', icon: 'bi-diagram-3', device: true, items: UCOORD_ITEMS },
  { key: 'wifi', label: 'Wireless', icon: 'bi-wifi', device: true, items: WIRELESS_ITEMS, desktopOnly: true },
  { key: 'network', label: 'Network', icon: 'bi-diagram-2', device: true, items: NETWORK_ITEMS, desktopOnly: true },
  { key: 'config', label: 'Configure', icon: 'bi-sliders', items: CONFIG_ITEMS, desktopOnly: true },
  { key: 'system', label: 'System', icon: 'bi-wrench', device: true, items: SYSTEM_ITEMS, desktopOnly: true },
  // Last, so it appears at the end of the bar on the occasions it appears at all.
  {
    key: 'changes',
    label: 'Changes',
    icon: 'bi-exclamation-circle',
    device: true,
    items: CHANGES_ITEMS,
    desktopOnly: true,
    whenChanges: true
  }
]

// Sections available for this build and breakpoint.
export function sections_for(
  isDevice: boolean,
  isEditor: boolean,
  wide: boolean,
  connected: boolean,
  hasChanges = false
): NavSection[] {
  return SECTIONS.filter((s) => {
    if (s.whenChanges && !hasChanges) return false
    if (s.device && !isDevice) return false
    if (s.device && !connected) return false
    if (!s.device && !isEditor) return false
    if (!wide && s.desktopOnly) return false
    return true
  })
}
