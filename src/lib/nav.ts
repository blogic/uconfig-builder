// Nav entries shared by the desktop sidebar and the mobile bottom bar.
// Bootstrap Icons match the ones the previous builder used per entry.

import { iface_enabled } from './interfaces.ts'
import { SERVICES, available_services, system_services } from './services.ts'
import type { ServiceEntry } from './services.ts'
import { title_for } from './labels.ts'
import type { UconfigDocument } from './types/uconfig'

export interface NavItem {
  key: string
  label: string
  icon: string
  // Services expands into SERVICE_ENTRIES rather than linking to a page of its
  // own, and Changes only appears once there is something to show.
  group?: boolean
  whenChanges?: boolean
  // A page that only some documents have anything to say on. Shaped after
  // LayoutNode.when, which does the same job for a field.
  when?: (doc: UconfigDocument) => boolean
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

// A guest network this device has settings for: switched on, and routed rather
// than bridged. An access point carries guest traffic but owns none of it, and
// a network that is off has nothing to address, so the page is absent in both
// cases rather than explaining itself.
function guest_routed(doc: UconfigDocument): boolean {
  const guest = (doc.interfaces as Record<string, Record<string, unknown>> | undefined)?.guest
  return iface_enabled(guest as { disable?: boolean } | undefined) && guest?.role === 'downstream'
}

// Pages of the Network section: the wired side, uplink and addressing.
// `net-guest` rather than `guest` because page keys share one flat namespace and
// `guest` already names the Wireless page that owns the guest SSID.
export const NETWORK_ITEMS: NavItem[] = [
  { key: 'wan', label: 'WAN', icon: 'bi-globe' },
  { key: 'lan', label: 'LAN', icon: 'bi-ethernet' },
  { key: 'net-guest', label: 'Guest', icon: 'bi-people', when: guest_routed }
]

// Edits arrive from several sections, so the pending list is a section of its
// own rather than an item inside whichever one happened to own it.
export const CHANGES_ITEMS: NavItem[] = [
  { key: 'changes', label: 'Pending', icon: 'bi-exclamation-circle' }
]

// Pages of the System section: what the device itself offers and does, rather
// than what its networks are for. State reports on it; the last three are one
// irreversible action each. Services expands rather than linking to a page,
// because a page holding only links to pages earns nothing.
export const SYSTEM_ITEMS: NavItem[] = [
  // First, because it is the one page here that answers a question rather than
  // asking one: arriving at System usually means wanting to know how the device
  // is doing.
  { key: 'state', label: 'Overview', icon: 'bi-speedometer2' },
  // `time` rather than `ntp`: the page holds the timezone as well, and the
  // editor's raw NTP page keeps that key.
  { key: 'time', label: 'Time', icon: 'bi-clock' },
  { key: 'system-services', label: 'Services', icon: 'bi-hdd-network', group: true },
  { key: 'reboot', label: 'Reboot', icon: 'bi-arrow-clockwise' },
  { key: 'firmware', label: 'Firmware', icon: 'bi-cpu' },
  { key: 'factory-reset', label: 'Factory Reset', icon: 'bi-exclamation-triangle' }
]

// Children of the System Services group. `svc:` rather than `service:` because
// these are the intent pages, not the schema-shaped ones the editor keeps under
// Configure, and page keys share one flat namespace.
export function system_service_entries(modules: string[] | null): NavItem[] {
  return system_services(modules).map((s) => ({ key: `svc:${s.config}`, label: s.label, icon: s.icon }))
}

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

// Pages that live inside a group rather than in a section's own item list.
// Anything asking whether the open page still exists has to look here too, or
// it will treat every grouped page as gone and navigate away from it.
export function group_pages(groups: Record<string, NavItem[]>): string[] {
  return Object.values(groups).flatMap((items) => items.map((i) => i.key))
}

// The pages of a section that apply right now. One place, because the sidebar
// and the effect that keeps the open page valid have to agree: a page the
// sidebar hides but the effect still counts is one the user cannot leave.
export function items_for(items: NavItem[], hasChanges: boolean, doc: UconfigDocument): NavItem[] {
  return items.filter((i) => {
    if (i.whenChanges && !hasChanges) return false
    if (i.when && !i.when(doc)) return false
    return true
  })
}

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
