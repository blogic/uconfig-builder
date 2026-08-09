import { default_width } from './channels'
import { iface_enabled } from './interfaces'
import { SERVICES, available_services } from './services'

export interface LayoutContext {
  role?: string
  band?: string
  allInterfaces?: Record<string, unknown>
  selfName?: string
  radios?: Record<string, unknown>
}

export interface WhenArg {
  data: Record<string, unknown>
  context: LayoutContext
}

export type WhenPredicate = (arg: WhenArg) => boolean

export interface LayoutNode {
  field?: string
  describe?: string
  widget?: string
  label?: string
  options?: unknown[]
  default?: unknown
  required?: boolean | WhenPredicate
  when?: WhenPredicate
  section?: string
  children?: LayoutNode[]
  objectSection?: string
  title?: string
  // Renders the section header without the collapse marker. A page whose every
  // section is worth reading has nothing to disclose.
  plain?: boolean
  toggleSection?: string
  mapSection?: string
  keyLabel?: string
  tabbed?: boolean
  renamable?: boolean
  item?: LayoutNode[]
  vlanSection?: boolean
  portsSection?: boolean
  dhcpSection?: boolean
  // The pool as a first/last address pair rather than the stored offset and
  // count. Derived, so it needs a component rather than a field node.
  dhcpRange?: boolean
  // The guest VLAN, which lives in the shared include. The field pipeline only
  // walks `data`, so a value held elsewhere needs a component of its own.
  guestVlan?: boolean
  disallow?: string
  multiPsk?: boolean
  aclField?: boolean
  mapList?: string
}

// `when` predicates receive { data, context } where data is the current object
// and context carries { role } (interfaces) or { band } (radios).
// describe: strings are short keys; en-GB.json holds the verbose wording.
const up: WhenPredicate = ({ context }) => context.role === 'upstream'
const down: WhenPredicate = ({ context }) => context.role === 'downstream'
const eff_addr = (data: Record<string, unknown>, context: LayoutContext): unknown =>
  data.addressing ?? (context.role === 'downstream' ? 'static' : 'dynamic')
const isStatic: WhenPredicate = ({ data, context }) => eff_addr(data, context) === 'static'
const isDynamic: WhenPredicate = ({ data, context }) => eff_addr(data, context) === 'dynamic'
const upStatic: WhenPredicate = (ctx) => up(ctx) && isStatic(ctx)

export const unitLayout: LayoutNode[] = [
  { field: 'hostname', describe: 'Device hostname.' },
  { field: 'timezone', widget: 'timezone' },
  { field: 'password', describe: 'Device password (shadow hash).' },
  { field: 'leds-active', describe: 'Force all LEDs off.' },
  { field: 'tty-login', describe: 'Require login on serial ports.' }
]

export const radioLayout: LayoutNode[] = [
  { field: 'channel', widget: 'channel', describe: 'Wireless channel.' },
  { field: 'channel-mode', widget: 'channel-mode', describe: 'Preferred 802.11 mode.' },
  { field: 'channel-width', widget: 'channel-width', describe: 'Channel width.' },
  { field: 'tx-power', widget: 'tx-power', describe: 'Transmit power (dBm).' },
  {
    field: 'he-multiple-bssid',
    describe: 'Use multiple-BSSID beacons.',
    when: ({ data }) => {
      const m = data['channel-mode'] ?? 'HE'
      return m === 'HE' || m === 'EHT'
    }
  },
  { field: 'legacy-rates', describe: 'Allow legacy 802.11b rates.', when: ({ context }) => context.band === '2G' },
  {
    field: 'allow-dfs',
    describe: 'Allow DFS channels.',
    when: ({ data, context }) =>
      context.band === '5G' &&
      (data.channel == null || data.channel === 'auto') &&
      (data['channel-width'] ?? default_width(context.band ?? '')) !== 160
  }
]

const ipv4Layout: LayoutNode[] = [
  { field: 'addressing', widget: 'addressing', describe: 'How the IPv4 address is assigned.' },
  { field: 'subnet', required: true, when: isStatic, describe: 'Static IPv4 (CIDR).' },
  { field: 'gateway', required: true, when: upStatic, describe: 'Static IPv4 gateway.' },
  { field: 'use-dns', widget: 'list', when: up, describe: 'DNS servers to use.' },
  { field: 'send-hostname', when: isDynamic, describe: 'Send hostname in DHCP requests.' }
]

const ipv6Layout: LayoutNode[] = [
  { field: 'addressing', widget: 'addressing-ro', when: up },
  { field: 'dhcpv6.mode', label: 'DHCPv6 Mode', when: down, describe: 'DHCPv6 server mode.' },
  { field: 'dhcpv6.announce-dns', label: 'Announce DNS', widget: 'list', when: down, describe: 'DNS servers to announce.' }
]

const ssidMode = (data: Record<string, unknown>): unknown =>
  (data.template as Record<string, unknown> | undefined)?.mode

const ssidLayout: LayoutNode[] = [
  { field: 'ssid', describe: 'Network name.' },
  {
    field: 'bss-mode',
    options: ['ap', 'wds-ap', 'wds-sta', 'wds-repeater'],
    default: 'ap',
    describe: 'BSS operation mode.'
  },
  {
    field: 'template.mode',
    label: 'Encryption',
    options: ['open', 'encrypted', 'enterprise', 'opportunistic'],
    default: 'encrypted',
    describe: 'Encryption behaviour.'
  },
  {
    field: 'template.security',
    default: 'maximum',
    describe: 'Encryption strength.',
    when: ({ data }) => {
      const m = ssidMode(data)
      return !!m && m !== 'open' && m !== 'opportunistic'
    }
  },
  { field: 'template.key', describe: 'Pre-shared key.', when: ({ data }) => ssidMode(data) === 'encrypted' },
  {
    field: 'template.radius-server',
    describe: 'Enterprise RADIUS server.',
    when: ({ data }) => ssidMode(data) === 'enterprise'
  },
  { field: 'wifi-radios', widget: 'bands' },
  {
    multiPsk: true,
    when: ({ data }) =>
      (data.template as Record<string, unknown> | undefined)?.mode === 'encrypted' &&
      (data.template as Record<string, unknown> | undefined)?.security === 'legacy'
  },
  { aclField: true },
  { field: 'hidden-ssid', describe: 'Hide the network.' },
  { field: 'isolate-clients', describe: 'Isolate clients from each other.' },
  { field: 'unicast-conversion', describe: 'Convert multicast to unicast.' }
]

export const interfaceLayout: LayoutNode[] = [
  { objectSection: 'ipv4', title: 'IPv4', children: ipv4Layout },
  { objectSection: 'ipv6', title: 'IPv6', children: ipv6Layout },
  { vlanSection: true },
  { mapSection: 'ssids', title: 'SSIDs', keyLabel: 'SSID', tabbed: true, renamable: false, item: ssidLayout },
  { portsSection: true },
  { section: 'Services', children: [{ field: 'services', widget: 'services' }] },
  { dhcpSection: true, when: down },
  { disallow: 'ipv4', when: down }
]

// --- Network section --------------------------------------------------------
//
// Intent-shaped views over the same document the Configure pages edit raw. Each
// asks what the network should do and leaves the schema shape to the renderer,
// so a page names a network rather than an interface.

// The interface carrying the main SSIDs: the downstream one on a router, and on
// an access point the single upstream that bridges everything. Resolved by role
// rather than by name, which is how the rest of the layouts already work and
// which avoids depending on `webui.profile`.
export function primary_iface(
  interfaces: Record<string, unknown> | undefined
): [string, Record<string, unknown>] | null {
  const entries = (Object.entries(interfaces ?? {}) as [string, Record<string, unknown>][]).filter(([, v]) =>
    iface_enabled(v as { disable?: boolean })
  )
  const named = (n: string) => entries.find(([k]) => k === n)
  const byRole = (r: string) => entries.find(([, v]) => v?.role === r)
  // A guest network is downstream too, so prefer the conventional name before
  // falling back to whichever downstream interface exists.
  return named('lan') ?? byRole('downstream') ?? named('wan') ?? byRole('upstream') ?? null
}

// Wireless: the network people join, without the interface that carries it.
export const wirelessLayout: LayoutNode[] = [
  { field: 'ssid', describe: 'The name people see when choosing a network.' },
  {
    field: 'template.key',
    label: 'Password',
    describe: 'At least 8 characters. Shared with everyone who joins.'
  },
  {
    field: 'template.security',
    label: 'Security',
    options: ['maximum', 'compatibility'],
    default: 'maximum',
    describe: 'Encryption strength.'
  },
  { field: 'wifi-radios', label: 'Bands', widget: 'bands' },
  { field: 'hidden-ssid', describe: 'Hide the network.' },
  { field: 'isolate-clients', describe: 'Isolate clients from each other.' }
]

// Radios: channel and power in plain terms, with the band-level settings that
// have no everyday phrasing kept together behind one disclosure.
export const radioIntentLayout: LayoutNode[] = [
  { field: 'channel', widget: 'channel', describe: 'Wireless channel.' },
  { field: 'channel-width', widget: 'channel-width', describe: 'Channel width.' },
  { field: 'tx-power', widget: 'tx-power', describe: 'Transmit power (dBm).' },
  {
    section: 'Advanced',
    children: [
      { field: 'channel-mode', widget: 'channel-mode', describe: 'Preferred 802.11 mode.' },
      {
        field: 'he-multiple-bssid',
        describe: 'Use multiple-BSSID beacons.',
        when: ({ data }) => {
          const m = data['channel-mode'] ?? 'HE'
          return m === 'HE' || m === 'EHT'
        }
      },
      { field: 'legacy-rates', describe: 'Allow legacy 802.11b rates.', when: ({ context }) => context.band === '2G' },
      {
        field: 'allow-dfs',
        describe: 'Allow DFS channels.',
        when: ({ data, context }) =>
          context.band === '5G' &&
          (data.channel == null || data.channel === 'auto') &&
          (data['channel-width'] ?? default_width(context.band ?? '')) !== 160
      },
      { field: 'maximum-clients', describe: 'Maximum associated clients.' }
    ]
  }
]

// WAN: how the device reaches the internet. Ports stay on the Configure page;
// this asks only where the address comes from.
export const wanLayout: LayoutNode[] = [
  {
    objectSection: 'ipv4',
    title: 'IPv4',
    plain: true,
    children: [
      { field: 'addressing', widget: 'addressing', describe: 'How the IPv4 address is assigned.' },
      { field: 'subnet', required: true, when: isStatic, describe: 'Static IPv4 (CIDR).' },
      { field: 'gateway', required: true, when: isStatic, describe: 'Static IPv4 gateway.' },
      { field: 'use-dns', widget: 'list', describe: 'DNS servers to use.' }
    ]
  },
  {
    objectSection: 'ipv6',
    title: 'IPv6',
    plain: true,
    children: [{ field: 'addressing', widget: 'addressing-ro' }]
  }
]

// LAN: the addresses handed to everything that joins. The pool is expressed as
// a range rather than the document's offset-and-count.
export const lanLayout: LayoutNode[] = [
  {
    objectSection: 'ipv4',
    title: 'IPv4',
    plain: true,
    children: [
      { field: 'subnet', required: true, label: 'Router address', describe: 'Static IPv4 (CIDR).' },
      { dhcpRange: true }
    ]
  },
  {
    objectSection: 'ipv6',
    title: 'IPv6',
    plain: true,
    children: [{ field: 'dhcpv6.mode', label: 'DHCPv6 Mode', describe: 'DHCPv6 server mode.' }]
  },
  { field: 'isolate-hosts', describe: 'Isolate clients from each other.' }
]

// Guest addressing, which only a router has: an access point bridges guest
// traffic onto the VLAN and the router upstream of it owns the subnet. No pool
// here, unlike LAN; the range the guest network hands out is not a decision
// this page asks about.
export const guestLayout: LayoutNode[] = [
  { section: 'VLAN', plain: true, children: [{ guestVlan: true }] },
  {
    objectSection: 'ipv4',
    title: 'IPv4',
    plain: true,
    children: [{ field: 'subnet', required: true, label: 'Router address', describe: 'Static IPv4 (CIDR).' }]
  },
  {
    objectSection: 'ipv6',
    title: 'IPv6',
    plain: true,
    children: [{ field: 'dhcpv6.mode', label: 'DHCPv6 Mode', describe: 'DHCPv6 server mode.' }]
  }
]

const serviceLayouts: Record<string, LayoutNode[]> = {
  ssh: [
    { field: 'port', describe: 'SSH server port.' },
    { field: 'cli-port', describe: 'CLI-over-SSH port.' },
    { field: 'authorized-keys', widget: 'list', describe: 'Authorised SSH keys.' },
    { field: 'password-authentication', describe: 'Allow password login.' }
  ],
  log: [
    { field: 'host', describe: 'Remote syslog host.' },
    { field: 'port', describe: 'Remote syslog port.' },
    { field: 'proto', describe: 'Syslog transport.' },
    { field: 'size', describe: 'Log buffer size (KiB).' },
    { field: 'priority', describe: 'Minimum syslog priority.' }
  ],
  'radius-server': [
    { field: 'auth-port', describe: 'RADIUS auth port.' },
    { field: 'acct-port', describe: 'RADIUS accounting port.' },
    { field: 'secret', describe: 'Shared RADIUS secret.' },
    { mapList: 'users', keyLabel: 'user' }
  ],
  adguardhome: [
    { field: 'webui-port', describe: 'Web interface port.' },
    { field: 'dns-intercept', describe: 'Intercept DNS traffic.' },
    { field: 'servers', widget: 'list', describe: 'Upstream DNS servers.' }
  ],
  ieee8021x: [{ field: 'radius-server', describe: 'RADIUS server to use.' }],
  lldp: [
    { field: 'hostname', describe: 'Announced hostname.' },
    { field: 'description', describe: 'Announced description.' },
    { field: 'location', describe: 'Announced location.' }
  ],
  mdns: [{ field: 'additional-hostnames', widget: 'list', describe: 'Extra announced hostnames.' }],
  tailscale: [
    { field: 'auto-start', describe: 'Start at boot.' },
    { field: 'exit-node', describe: 'Advertise as exit node.' },
    { field: 'announce-routes', describe: 'Announce LAN routes.' }
  ]
}

// One always-present section per configurable service. Services with a curated
// layout get inlined describe text; the rest auto-render from the schema.
function layout_from(list: typeof SERVICES): LayoutNode[] {
  return list
    .filter((s) => s.config)
    .map((s) => ({
      objectSection: s.config as string,
      children: serviceLayouts[s.config as string]
    }))
}

export function services_layout(modules: string[] | null): LayoutNode[] {
  return layout_from(available_services(modules))
}

// Settings for the System > Services pages. The switch and the networks a
// service is offered on are drawn by the page rather than listed here: neither
// is a field of the service block, and both matter more than anything that is.
// Ports and buffer sizes go behind Advanced because changing them is rare and a
// service on a surprising port is hard to diagnose from anywhere else.
export const serviceIntentLayouts: Record<string, LayoutNode[]> = {
  ssh: [
    { field: 'password-authentication', label: 'Allow password login', describe: 'Allow password login.' },
    { field: 'authorized-keys', label: 'Authorised keys', widget: 'list', describe: 'Authorised SSH keys.' },
    {
      section: 'Advanced',
      children: [
        { field: 'port', describe: 'SSH server port.' },
        { field: 'cli-port', label: 'CLI port', describe: 'CLI-over-SSH port.' }
      ]
    }
  ],
  mdns: [{ field: 'additional-hostnames', label: 'Extra names', widget: 'list', describe: 'Extra announced hostnames.' }],
  lldp: [
    { field: 'hostname', label: 'Announced name', describe: 'Announced hostname.' },
    { field: 'description', describe: 'Announced description.' },
    { field: 'location', describe: 'Announced location.' }
  ],
  log: [
    { field: 'host', label: 'Syslog server', describe: 'Remote syslog host.' },
    { field: 'port', describe: 'Remote syslog port.' },
    { field: 'proto', label: 'Transport', describe: 'Syslog transport.' },
    {
      section: 'Advanced',
      children: [
        { field: 'size', describe: 'Log buffer size (KiB).' },
        { field: 'priority', describe: 'Minimum syslog priority.' }
      ]
    }
  ]
}

export const servicesLayout: LayoutNode[] = layout_from(SERVICES)
