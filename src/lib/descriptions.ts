// Inline descriptions for schema-auto-rendered fields (SchemaObject), keyed by
// property key. Values are short keys; en-GB.json holds the verbose wording.
// Layout-driven fields carry their own describe in layouts.js; this covers the
// fields that have no layout entry (quality-of-service, RADIUS-server users,
// DHCP pool and similar nested objects).
export const DESCRIPTIONS: Record<string, string> = {
  // quality-of-service
  services: 'Named services to classify.',
  'bulk-detection': 'Auto-classify bulk flows.',
  classifier: 'Custom traffic classifiers.',
  dscp: 'DSCP for matching packets.',
  'packets-per-second': 'PPS that marks a bulk flow.',
  ports: 'Protocol/port match rules.',
  dns: 'FQDN match rules.',
  // dhcp pool
  'lease-first': 'First pool address (last octet).',
  'lease-count': 'Addresses in the pool.',
  'lease-time': 'Lease validity.',
  // radius-server users
  'auth-type': 'Authentication type.',
  password: 'User password.',
  'vlan-id': 'VLAN ID for this user.',
  'rate-limit-upload': 'Upload limit (kbps).',
  'rate-limit-download': 'Download limit (kbps).'
}

// Prose shown under each page header, keyed by nav section. The wording for
// unit, radios and interface is carried over from the previous builder.
export const PAGE_DESCRIPTIONS: Record<string, string> = {
  unit: 'Configure basic device settings including hostname, location, and timezone. These settings identify your device on the network and ensure proper time management.',
  radios:
    'Configure wireless radio settings for different frequency bands. Adjust power levels, channels, and other radio parameters to optimize wireless performance.',
  interface:
    'Configure network interface settings including IP addressing, VLAN configuration, and DHCP settings. Network interfaces connect your device to different network segments and services.',
  interfaces:
    'Logical networks on this device. Each interface carries its own addressing, SSIDs, ports and services.',
  'service-list': 'Services available on this device. Choose one to configure it.',
  clients: 'Devices seen on the network, split into those currently connected and those that have dropped off. Wireless clients show their signal and negotiated rate.',
  state: 'What the device is doing right now: how long it has been up, what it is running, how hard it is working, and how much memory and flash it has used.',
  traffic: 'Throughput on the upstream interface. The gauges show the current rate; the chart shows recorded history.',
  ucoord: 'Devices coordinated with this one, grouped by venue. Only the highlighted peer is managed from this session.',
  reboot: 'Restart the device. Clients lose their connection until it comes back up, usually within a minute.',
  firmware: 'Upload a firmware image and flash it. The device reboots once the image is written.',
  'factory-reset': 'Erase the configuration and return the device to its defaults.',
  ntp: 'Configure NTP (Network Time Protocol) servers for time synchronisation. NTP keeps the device clock accurate by synchronising with reliable time servers.',
  changes: 'Everything edited since this configuration was loaded, grouped by where you changed it.',
  json: 'The resulting uConfig document. Download it, save it locally, or apply it to a connected device.',

  // Wireless and Network sections: what the network does, rather than how the
  // document is shaped. Deliberately shorter than the Configure pages above.
  wireless: 'The Wi-Fi network your own devices join. Changes apply to every radio the device has.',
  guest: 'A separate network for visitors. Guests reach the internet, and nothing else on your network.',
  'net-radios': 'The radios your Wi-Fi networks run on. Channel and power settings per band.',
  wan: 'How this device reaches the internet.',
  lan: 'Your own network: the addresses this device hands out to everything that joins.'
}

// Per-service page prose, keyed by the `services` schema key. ssh, radius-server,
// log, mdns and lldp are carried over from the previous builder; the remaining
// services had no page there, so their wording follows the same register.
export const SERVICE_DESCRIPTIONS: Record<string, string> = {
  ssh: 'Configure the SSH (Secure Shell) server for secure remote access to the device.',
  'radius-server':
    'Configure the local RADIUS service settings. The RADIUS service provides authentication and authorization services for network devices.',
  log: 'Configure local log buffer and remote syslog support to send log messages to a remote syslog server in addition to local logging.',
  mdns: 'Configure the mDNS (Multicast DNS) service for local network service discovery. mDNS allows devices to advertise and discover services on the local network without a DNS server.',
  lldp: 'Configure the LLDP (Link Layer Discovery Protocol) service to announce system information to connected network devices for network topology discovery.',
  adguardhome:
    'Configure the AdGuard Home service for network-wide DNS filtering. AdGuard Home blocks advertising and tracking domains for every client on the network.',
  ieee8021x:
    'Configure the 802.1X service for port-based network access control, authenticating wired clients against a RADIUS server before granting access.',
  'quality-of-service':
    'Configure quality of service to prioritise latency-sensitive traffic and share the available bandwidth between clients.',
  tailscale:
    'Configure the Tailscale service to join the device to a private mesh network, optionally advertising local routes or acting as an exit node.'
}
