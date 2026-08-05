// Human labels for schema property keys. Kept free of any schema-JSON import so
// the i18n extraction tooling can reuse title_for without an import assertion.

const LABEL_OVERRIDES: Record<string, string> = {
  // Radio band keys are the schema's enum values; these are display-only.
  '2G': '2.4GHz',
  '5G': '5GHz',
  '6G': '6GHz',
  'ntp-servers': 'NTP Servers',
  'leds-active': 'LEDs Active',
  'tty-login': 'TTY Login',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  vlan: 'VLAN',
  'use-dns': 'DNS Servers',
  ssids: 'SSIDs',
  'ieee8021x-ports': '802.1X Ports',
  ssid: 'SSID',
  bssid: 'BSSID',
  'bss-mode': 'BSS Mode',
  'hidden-ssid': 'Hidden SSID',
  'wifi-radios': 'WiFi Radios',
  'multi-psk': 'Multi-PSK',
  ssh: 'SSH',
  lldp: 'LLDP',
  mdns: 'mDNS',
  ieee8021x: '802.1X',
  adguardhome: 'AdGuard Home',
  'quality-of-service': 'Quality of Service',
  'radius-server': 'RADIUS Server',
  tailscale: 'Tailscale'
}

export function title_for(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key]
  return key
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
