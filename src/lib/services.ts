// Hardcoded set of services available in headless mode. Later this will be
// replaced by the list of services actually installed on a connected device.
//
//  - config:  the key in the top-level `services` schema, or null if the
//             service has no configuration block.
//  - iface:   interface selectability - true (any), false (not per-interface),
//             or 'downstream' (downstream interfaces only).
export interface ServiceEntry {
  name: string
  config: string | null
  iface: boolean | 'downstream'
}

export const SERVICES: ServiceEntry[] = [
  { name: 'ssh', config: 'ssh', iface: true },
  { name: 'log', config: 'log', iface: false },
  { name: 'radius-server', config: 'radius-server', iface: true },
  { name: 'ntp', config: null, iface: false },
  { name: 'adguardhome', config: 'adguardhome', iface: 'downstream' },
  { name: 'ieee8021x', config: 'ieee8021x', iface: true },
  { name: 'lldp', config: 'lldp', iface: true },
  { name: 'mdns', config: 'mdns', iface: true },
  { name: 'quality-of-service', config: 'quality-of-service', iface: false },
  { name: 'tailscale', config: 'tailscale', iface: true },
  { name: 'fingerprint', config: null, iface: true },
  { name: 'nlbwmon', config: null, iface: true },
  { name: 'samba4', config: null, iface: true },
  { name: 'state', config: null, iface: false },
  { name: 'ucoord', config: null, iface: false },
  { name: 'webui', config: null, iface: false }
]

// Service names selectable on an interface with the given role.
export function interface_services(role: string | undefined): string[] {
  return SERVICES.filter((s) => s.iface === true || (s.iface === 'downstream' && role === 'downstream')).map(
    (s) => s.name
  )
}

// Config-schema keys for services that are available and configurable.
export const SERVICE_CONFIG_KEYS: string[] = SERVICES.filter((s) => s.config).map((s) => s.config as string)
