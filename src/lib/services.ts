// Every service the schema knows about. A connected device reports which
// optional packages it has installed, and `service_available` narrows this set
// to those; the offline editor uses it whole.
//
//  - pkg:     the sentinel name under /etc/uconfig/modules on the device, or
//             null for a service that ships with the base system. The two
//             namespaces differ: the package for `quality-of-service` is
//             called `qosify`.
//  - config:  the key in the top-level `services` schema, or null if the
//             service has no configuration block.
//  - iface:   interface selectability - true (any), false (not per-interface),
//             or 'downstream' (downstream interfaces only).
export interface ServiceEntry {
  name: string
  pkg: string | null
  config: string | null
  iface: boolean | 'downstream'
}

export const SERVICES: ServiceEntry[] = [
  { name: 'ssh', pkg: null, config: 'ssh', iface: true },
  { name: 'log', pkg: null, config: 'log', iface: false },
  { name: 'radius-server', pkg: null, config: 'radius-server', iface: true },
  { name: 'ntp', pkg: null, config: null, iface: false },
  { name: 'adguardhome', pkg: 'adguardhome', config: 'adguardhome', iface: 'downstream' },
  { name: 'ieee8021x', pkg: 'ieee8021x', config: 'ieee8021x', iface: true },
  { name: 'lldp', pkg: 'lldp', config: 'lldp', iface: true },
  { name: 'mdns', pkg: 'mdns', config: 'mdns', iface: true },
  { name: 'quality-of-service', pkg: 'qosify', config: 'quality-of-service', iface: false },
  { name: 'tailscale', pkg: 'tailscale', config: 'tailscale', iface: true },
  { name: 'fingerprint', pkg: null, config: null, iface: true },
  { name: 'nlbwmon', pkg: null, config: null, iface: true },
  { name: 'samba4', pkg: 'samba4', config: null, iface: true },
  { name: 'state', pkg: null, config: null, iface: false },
  { name: 'ucoord', pkg: 'ucoord', config: null, iface: false },
  { name: 'webui', pkg: null, config: null, iface: false }
]

// A device reports the optional packages it has installed. Anything without a
// sentinel name ships with the base system and is always there; `null` means no
// device has said, as in the offline editor, so nothing is filtered.
export function service_available(entry: ServiceEntry, modules: string[] | null): boolean {
  if (!modules || !entry.pkg) return true
  return modules.includes(entry.pkg)
}

export function available_services(modules: string[] | null): ServiceEntry[] {
  return SERVICES.filter((s) => service_available(s, modules))
}

// Service names selectable on an interface with the given role.
export function interface_services(role: string | undefined, modules: string[] | null = null): string[] {
  return available_services(modules)
    .filter((s) => s.iface === true || (s.iface === 'downstream' && role === 'downstream'))
    .map((s) => s.name)
}

// Config-schema keys for configurable services, narrowed to what the device
// can run. A block for a service the device lacks is left in the document
// untouched; it is only hidden from the UI.
export function service_config_keys(modules: string[] | null = null): string[] {
  return available_services(modules)
    .filter((s) => s.config)
    .map((s) => s.config as string)
}

export const SERVICE_CONFIG_KEYS: string[] = service_config_keys(null)
