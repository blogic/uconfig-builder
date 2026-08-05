// Generated from src/lib/data/schema.json by tools/schema-types.mjs.
// Do not edit by hand; run `npm run types:schema` after changing the schema.

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export type InterfacePorts = 'auto' | 'tagged' | 'un-tagged'
export type Ethernet = {
  /**
   * The list of physical network devices that shall be configured. The names are logical ones and wildcardable.
   */
  'select-ports'?: string[]
  /**
   * The link speed that shall be forced.
   */
  speed?: 10 | 100 | 1000 | 2500 | 5000 | 10000
  /**
   * The duplex mode that shall be forced.
   */
  duplex?: 'half' | 'full'
}[]

/**
 * OpenWrt uconfig schema
 */
export interface HttpsUconfigOpenwrtOrgUconfigSchemaJson {
  /**
   * The device will reject any configuration that causes warnings if strict mode is enabled.
   */
  strict?: boolean
  /**
   * The unique ID of the configuration. This is the unix timestamp of when the config was created.
   */
  uuid?: number
  unit?: Unit
  radios?: {
    [k: string]: Radio
  }
  interfaces?: {
    [k: string]: Interface
  }
  definitions?: Definitions
  ethernet?: Ethernet
  offload?: Offload
  services?: Service
}
/**
 * A device has certain properties that describe its identity and location. These properties are described inside this object.
 */
export interface Unit {
  /**
   * The hostname that shall be set on the device. If this field is not set, then the devices serial number is used.
   */
  hostname?: string
  /**
   * This allows you to change the TZ of the device.
   */
  timezone?: string
  /**
   * This allows forcing all LEDs off.
   */
  'leds-active'?: boolean
  /**
   * The password that shall be set on the device. This needs to be the hash that can be found on /etc/shadow.
   */
  password?: string
  /**
   * Require username/password login on tty/S ports.
   */
  'tty-login'?: boolean
}
/**
 * Describe a physical radio on the AP. A radio is be parent to several VAPs. They all share the same physical properties.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface Radio {
  /**
   * Specifies the wireless band to configure the radio for. Available radio device phys on the target system are matched by the wireless band given here. If multiple radio phys support the same band, the settings specified here will be applied to all of them.
   */
  band?: '2G' | '5G' | '6G'
  /**
   * Specifies the wireless channel to use. A value of 'auto' starts the ACS algorithm.
   */
  channel?: number | 'auto'
  /**
   * Define the ideal channel mode that the radio shall use. This can be 802.11n, 802.11ac or 802.11ax. This is just a hint for the AP. If the requested value is not supported then the AP will use the highest common denominator.
   */
  'channel-mode'?: 'HT' | 'VHT' | 'HE' | 'EHT'
  /**
   * The channel width that the radio shall use. This is just a hint for the AP. If the requested value is not supported then the AP will use the highest common denominator.
   */
  'channel-width'?: 20 | 40 | 80 | 160 | 320 | 8080
  /**
   * Pass a list of valid-channels that can be used during ACS.
   */
  'valid-channels'?: number[]
  /**
   * This property defines whether a radio may use DFS channels.
   */
  'allow-dfs'?: boolean
  /**
   * Stations that do no fulfill these HT modes will be rejected.
   */
  'require-mode'?: 'HT' | 'VHT' | 'HE'
  /**
   * This option specifies the transmission power in dBm
   */
  'tx-power'?: number
  rates?: Radio1
  /**
   * Allow legacy 802.11b data rates.
   */
  'legacy-rates'?: boolean
  /**
   * Set the maximum number of clients that may connect to this radio. This value is accumulative for all attached VAP interfaces.
   */
  'maximum-clients'?: number
  /**
   * Enabling this option will make the PHY broadcast its BSSs using the multiple BSSID beacon IE.
   */
  'he-multiple-bssid'?: boolean
}
/**
 * The rate configuration of this BSS.
 */
export interface Radio1 {
  /**
   * The beacon rate that shall be used by the BSS. Values are in Mbps.
   */
  beacon?: 0 | 1000 | 2000 | 5500 | 6000 | 9000 | 11000 | 12000 | 18000 | 24000 | 36000 | 48000 | 54000
  /**
   * The multicast rate that shall be used by the BSS. Values are in Mbps.
   */
  multicast?: 0 | 1000 | 2000 | 5500 | 6000 | 9000 | 11000 | 12000 | 18000 | 24000 | 36000 | 48000 | 54000
}
/**
 * This section describes the logical network interfaces of the device. Interfaces as their primary have a role that is upstream, downstream, guest, ....
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface Interface {
  /**
   * The role defines if the interface is upstream or downstream facing.
   */
  role?: 'upstream' | 'downstream'
  /**
   * Allows disabling an SSID from the UI.
   */
  disable?: boolean
  ipv4?: Interface1
  ipv6?: Interface2
  vlan?: Interface3
  ssids?: {
    [k: string]: Interface4
  }
  ports?: {
    [k: string]: InterfacePorts
  }
  /**
   * The list of physical network devices that shall serve .1x for this interface.
   */
  'ieee8021x-ports'?: {
    [k: string]: InterfacePorts
  }
  /**
   * This option makes sure that any traffic leaving this interface is isolated and all local IP ranges are blocked. It essentially enforces "guest network" firewall settings.
   */
  'isolate-hosts'?: boolean
  'broad-band'?: Interface5
  'quality-of-service'?: Interface6
  /**
   * The services that shall be offered on this logical interface. These are just strings such as "ssh", "mdns"
   */
  services?: string[]
}
/**
 * This section describes the IPv4 properties of a logical interface.
 */
export interface Interface1 {
  /**
   * This option defines the method by which the IPv4 address of the interface is chosen.
   */
  addressing?: 'dynamic' | 'static' | 'none'
  /**
   * This option defines the static IPv4 of the logical interface in CIDR notation. auto/24 can be used, causing the configuration layer to automatically use and address range from globals.ipv4-network.
   */
  subnet?: string
  /**
   * This option defines the static IPv4 gateway of the logical interface.
   */
  gateway?: string
  /**
   * include the devices hostname inside DHCP requests
   */
  'send-hostname'?: boolean
  /**
   * Define which DNS servers shall be used. This can either be a list of static IPv4 addresse or dhcp (use the server provided by the DHCP lease)
   */
  'use-dns'?: string[]
  /**
   * This option only applies to "downstream" interfaces. The downstream interface will prevent traffic going out to the listed CIDR4s. This can be used to prevent a guest / captive interface being able to communicate with RFC1918 ranges. Setting this option to 'true' will block all RFC1918 ranges.
   */
  'disallow-upstream-subnet'?: boolean | string[]
  'dhcp-pool'?: InterfaceIpv4
  'dhcp-leases'?: {
    [k: string]: InterfaceIpv41
  }
}
/**
 * This section describes the DHCP server configuration
 */
export interface InterfaceIpv4 {
  /**
   * The last octet of the first IPv4 address in this DHCP pool.
   */
  'lease-first'?: number
  /**
   * The number of IPv4 addresses inside the DHCP pool.
   */
  'lease-count'?: number
  /**
   * How long the lease is valid before a RENEW must be issued.
   */
  'lease-time'?: string
  /**
   * The DNS server sent to clients as DHCP option 6.
   */
  'use-dns'?: string[]
}
/**
 * This section describes the static DHCP leases of this logical interface.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface InterfaceIpv41 {
  /**
   * The MAC address of the host that this lease shall be used for.
   */
  macaddr?: string
  /**
   * The offset of the IP that shall be used in relation to the first IP in the available range.
   */
  'lease-offset'?: number
  /**
   * How long the lease is valid before a RENEW muss ne issued.
   */
  'lease-time'?: string
  /**
   * Shall the hosts hostname be made available locally via DNS.
   */
  'publish-hostname'?: boolean
}
/**
 * This section describes the IPv6 properties of a logical interface.
 */
export interface Interface2 {
  /**
   * This option defines the method by which the IPv6 subnet of the interface is acquired. In static addressing mode, the specified subnet and gateway, if any, are configured on the interface in a fixed manner. Also - if a prefix size hint is specified - a prefix of the given size is allocated from each upstream received prefix delegation pool and assigned to the interface. In dynamic addressing mode, a DHCPv6 client will be launched to obtain IPv6 prefixes for the interface itself and for downstream delegation. Note that dynamic addressing usually only ever makes sense on upstream interfaces.
   */
  addressing?: 'dynamic' | 'static'
  /**
   * This option defines a static IPv6 prefix in CIDR notation to set on the logical interface. A special notation "auto/64" can be used, causing the configuration agent to automatically allocate a suitable prefix from the IPv6 address pool specified in globals.ipv6-network. This property only applies to static addressing mode. Note that this is usually not needed due to DHCPv6-PD assisted prefix assignment.
   */
  subnet?: string
  /**
   * This option defines the static IPv6 gateway of the logical interface. It only applies to static addressing mode. Note that this is usually not needed due to DHCPv6-PD assisted prefix assignment.
   */
  gateway?: string
  /**
   * For dynamic addressing interfaces, this property specifies the prefix size to request from an upstream DHCPv6 server through prefix delegation. For static addressing interfaces, it specifies the size of the sub-prefix to allocate from the upstream-received delegation prefixes for assignment to the logical interface.
   */
  'prefix-size'?: number
  dhcpv6?: InterfaceIpv6
}
/**
 * This section describes the DHCPv6 server configuration
 */
export interface InterfaceIpv6 {
  /**
   * Specifies the DHCPv6 server operation mode. When set to "stateless", the system will announce router advertisements only, without offering stateful DHCPv6 service. When set to "stateful", emitted router advertisements will instruct clients to obtain a DHCPv6 lease. When set to "hybrid", clients can freely chose whether to self-assign a random address through SLAAC, whether to request an address via DHCPv6, or both. For maximum compatibility with different clients, it is recommended to use the hybrid mode. The special mode "relay" will instruct the unit to act as DHCPv6 relay between this interface and any of the IPv6 interfaces in "upstream" mode.
   */
  mode?: 'hybrid' | 'stateless' | 'stateful' | 'relay'
  /**
   * Overrides the DNS server to announce in DHCPv6 and RA messages. By default, the device will announce its own local interface address as DNS server, essentially acting as proxy for downstream clients. By specifying a non-empty list of IPv6 addresses here, this default behaviour can be overridden.
   */
  'announce-dns'?: string[]
  /**
   * Selects a specific downstream prefix or a number of downstream prefix ranges to announce in DHCPv6 and RA messages. By default, all prefixes configured on a given downstream interface are advertised. By specifying an IPv6 prefix in CIDR notation here, only prefixes covered by this CIDR are selected.
   */
  'filter-prefix'?: string
}
/**
 * This section describes the vlan behaviour of a logical network interface.
 */
export interface Interface3 {
  /**
   * This is the pvid of the vlan that shall be assigned to the interface. The individual physical network devices contained within the interface need to be told explicitly if egress traffic shall be tagged.
   */
  id?: number
  /**
   * Upstream interfaces can prOvide NAT for downstream interfaces that have a different VLAN Id
   */
  trunks?: number[]
}
/**
 * A device has certain properties that describe its identity and location. These properties are described inside this object.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface Interface4 {
  /**
   * Allows disabling an SSID from the UI.
   */
  disable?: boolean
  /**
   * An SSID can have a special purpose such as the hidden on-boarding BSS. All purposes other than "user-defined" are static pre-defined configurations.
   */
  purpose?: 'user-defined' | 'system-defaults'
  /**
   * The configuration/behaviour template used by the BSS.
   */
  template?: {
    /**
     * The template mode that defines the encryption behaviour.
     */
    mode?: 'open' | 'encrypted' | 'enterprise' | 'batman-adv' | 'opportunistic'
    /**
     * The encryption strength used by this template.
     */
    security?: 'legacy' | 'compatibility' | 'maximum'
    /**
     * The Pre Shared Key for encrypted or batman-adv templates.
     */
    key?: string
    /**
     * The RADIUS server name for enterprise template. Use "local" for built-in RADIUS server.
     */
    'radius-server'?: string
  }
  /**
   * The list of radios hat the SSID should be broadcasted on. The configuration layer will use the first matching phy/band.
   */
  'wifi-radios'?: string[]
  /**
   * Selects the operation mode of the wireless network interface controller.
   */
  'bss-mode'?: 'ap' | 'sta' | 'mesh' | 'wds-ap' | 'wds-sta' | 'wds-repeater'
  /**
   * The broadcasted SSID of the wireless network and for for managed mode the SSID of the network you’re connecting to
   */
  ssid?: string
  encryption?: InterfaceSsid
  /**
   * Override the BSSID of the network, only applicable in adhoc or sta mode.
   */
  bssid?: string
  /**
   * Disables the broadcasting of beacon frames if set to 1 and,in doing so, hides the ESSID.
   */
  'hidden-ssid'?: boolean
  /**
   * Isolates wireless clients from each other on this BSS.
   */
  'isolate-clients'?: boolean
  /**
   * Convert multicast traffic to unicast on this BSS.
   */
  'unicast-conversion'?: boolean
  /**
   * This option allows embedding custom vendor specific IEs inside the beacons of a BSS in AP mode.
   */
  'vendor-elements'?: string
  'multi-psk'?: {
    [k: string]: InterfaceSsid1
  }
  'rate-limit'?: InterfaceSsid2 | number
  roaming?: InterfaceSsid3 | boolean
  'access-control-list'?: InterfaceSsid4
}
/**
 * A device has certain properties that describe its identity and location. These properties are described inside this object.
 */
export interface InterfaceSsid {
  /**
   * The wireless encryption protocol that shall be used for this BSS
   */
  proto?:
    | 'none'
    | 'owe'
    | 'owe-transition'
    | 'psk'
    | 'psk2'
    | 'psk-mixed'
    | 'wpa'
    | 'wpa2'
    | 'wpa-mixed'
    | 'sae'
    | 'sae-mixed'
    | 'wpa3'
    | 'wpa3-192'
    | 'wpa3-mixed'
  /**
   * The Pre Shared Key (PSK) that is used for encryption on the BSS when using any of the WPA-PSK modes.
   */
  key?: string
  /**
   * Enable 802.11w Management Frame Protection (MFP) for this BSS.
   */
  ieee80211w?: 'disabled' | 'optional' | 'required'
  /**
   * PMKSA created through EAP authentication and RSN preauthentication can be cached.
   */
  'key-caching'?: boolean
  /**
   * The name of the radius server that shall be used. Use "local" for built-in RADIUS server, or reference a server defined in the definitions block.
   */
  'radius-server'?: string
}
/**
 * A SSID can have multiple PSK/VID mappings. Each one of them can be bound to a specific MAC or be a wildcard.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface InterfaceSsid1 {
  mac?: string[]
  /**
   * The Pre Shared Key (PSK) that is used for encryption on the BSS when using any of the WPA-PSK modes.
   */
  key?: string
  'vlan-id'?: number
}
/**
 * The UE rate-limiting configuration of this BSS.
 */
export interface InterfaceSsid2 {
  /**
   * The ingress rate to which hosts will be shaped. Values are in Mbps
   */
  'ingress-rate'?: number
  /**
   * The egress rate to which hosts will be shaped. Values are in Mbps
   */
  'egress-rate'?: number
}
/**
 * Enable 802.11r Fast Roaming for this BSS.
 */
export interface InterfaceSsid3 {
  /**
   * Shall the pre authenticated message exchange happen over the air or distribution system.
   */
  'message-exchange'?: 'air' | 'ds'
  /**
   * Whether to generate FT response locally for PSK networks. This avoids use of PMK-R1 push/pull from other APs with FT-PSK networks.
   */
  'generate-psk'?: boolean
  /**
   * Mobility Domain identifier (dot11FTMobilityDomainID, MDID).
   */
  'domain-identifier'?: string
}
/**
 * The MAC ACL that defines which clients are allowed or denied to associations.
 */
export interface InterfaceSsid4 {
  /**
   * Defines if this is an allow or deny list.
   */
  mode?: 'allow' | 'deny'
  /**
   * Association requests will be denied if the rssi is below this threshold.
   */
  'mac-address'?: string[]
}
/**
 * Broadband access credentials and connection parameters for upstream interfaces (PPPoE, WWAN).
 */
export interface Interface5 {
  /**
   * Broadband connection type. When set, ipv4/ipv6 addressing sections are ignored and the connection is configured entirely from this section.
   */
  type?: 'pppoe' | 'wwan'
  /**
   * Full sysfs path of the modem device for WWAN connections (e.g. /sys/devices/platform/soc/20980000.usb/usb1/1-1).
   */
  device?: string
  /**
   * Access point name for cellular connections.
   */
  apn?: string
  /**
   * SIM card PIN code.
   */
  pincode?: string
  /**
   * IP version negotiated by the modem.
   */
  'ip-type'?: 'ipv4' | 'ipv6' | 'ipv4v6'
  /**
   * Authentication username for the broadband connection.
   */
  username?: string
  /**
   * Authentication password for the broadband connection.
   */
  password?: string
  /**
   * PPPoE service name filter. Only connect to access concentrators advertising this service.
   */
  'service-name'?: string
  /**
   * PPPoE access concentrator name filter.
   */
  'ac-name'?: string
}
/**
 * This section describes the available upstream bandwidth in "mbit". Both values need to be enabled for DSCP classification to get enabled.
 */
export interface Interface6 {
  /**
   * The upstream bandwidth.
   */
  'bandwidth-up'?: number
  /**
   * The downstream bandwidth.
   */
  'bandwidth-down'?: number
}
/**
 * A device has certain global properties that are used to derive parts of the final configuration that gets applied.
 */
export interface Definitions {
  /**
   * Define the IPv4 range that is delegatable to the downstream interfaces This is described as a CIDR block. (192.168.0.0/16, 172.16.128/17)
   */
  'ipv4-network'?: string
  /**
   * Define the IPv6 range that is delegatable to the downstream interfaces This is described as a CIDR block. (fdca:1234:4567::/48)
   */
  'ipv6-network'?: string
  /**
   * This is an array of URL/IP of the upstream NTP servers that the unit shall use to acquire its current time.
   */
  'ntp-servers'?: string[]
  'radius-servers'?: {
    [k: string]: Definitions1
  }
}
/**
 * When using EAP encryption we need to provide the required information allowing us to connect to the AAA servers.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface Definitions1 {
  /**
   * NAS-Identifier string for RADIUS messages. When used, this should be unique to the NAS within the scope of the RADIUS server.
   */
  'nas-identifier'?: string
  /**
   * This will enable support for Chargeable-User-Identity (RFC 4372).
   */
  'chargeable-user-id'?: boolean
  /**
   * Dynamic Authorization Extensions (DAE) is an extension to Radius.
   */
  'dynamic-authorization'?: {
    /**
     * The IP of the DAE client.
     */
    host?: string
    /**
     * The network port that the DAE client can connet on.
     */
    port?: number
    /**
     * The shared DAE authentication secret.
     */
    secret?: string
  }
  authentication?: DefinitionsRadiusServers & {
    /**
     * The network port of our Radius server.
     */
    port?: number
  }
  accounting?: DefinitionsRadiusServers & {
    /**
     * The network port of our Radius server.
     */
    port?: number
    /**
     * The interim accounting update interval. This value is defined in seconds.
     */
    interval?: number
  }
}
/**
 * Describe the properties of a Radius server.
 */
export interface DefinitionsRadiusServers {
  /**
   * The URI of our Radius server.
   */
  host?: string
  /**
   * The shared Radius authentication secret.
   */
  secret?: string
  /**
   * The additional Access-Request attributes that gets sent to the server.
   */
  'request-attribute'?: {
    /**
     * The ID of the RADIUS attribute
     */
    id?: number
    value?: number | string
  }[]
}
/**
 * Offloading configuration for hardware and software acceleration.
 */
export interface Offload {
  /**
   * Controls firewall flow offloading. "none" disables offloading, "software" enables software flow offloading, "hardware" enables both software and hardware flow offloading.
   */
  firewall?: 'none' | 'software' | 'hardware'
}
/**
 * This section describes all of the services that may be present on the AP. Each service is then referenced via its name inside an interface, ssid, ...
 */
export interface Service {
  adguardhome?: Service1
  ieee8021x?: Service2
  lldp?: Service3
  log?: Service4
  mdns?: Service5
  'quality-of-service'?: Service6
  'radius-server'?: Service7
  ssh?: Service8
  tailscale?: Service9
}
/**
 * This section can be used to setup the AdguardHome service
 */
export interface Service1 {
  /**
   * The port that the WebUI will run on.
   */
  'webui-port'?: number
  /**
   * Intercept/redirect all DNS traffic on enabled interfaces
   */
  'dns-intercept'?: boolean
  /**
   * A list of upstream servers the requests get forwarded to
   */
  servers?: string[]
}
/**
 * This section allows enabling wired ieee802.1X
 */
export interface Service2 {
  /**
   * The name of the radius server that shall be used. Use "local" for built-in RADIUS server, or reference a server defined in the definitions block.
   */
  'radius-server'?: string
}
/**
 * This section can be used to enable lldp on network ports.
 */
export interface Service3 {
  /**
   * The hostname that gets announced.
   */
  hostname?: string
  /**
   * The description that gets announced.
   */
  description?: string
  /**
   * The location that gets announced.
   */
  location?: string
}
/**
 * This section can be used to configure remote syslog support.
 */
export interface Service4 {
  /**
   * IP address of a syslog server to which the log messages should be sent in addition to the local destination.
   */
  host?: string
  /**
   * Port number of the remote syslog server specified with log_ip.
   */
  port?: number
  /**
   * Sets the protocol to use for the connection, either tcp or udp.
   */
  proto?: 'tcp' | 'udp'
  /**
   * Size of the file based log buffer in KiB. This value is used as the fallback value for log_buffer_size if the latter is not specified.
   */
  size?: number
  /**
   * Filter messages by their log priority. the value maps directly to the 0-7 range used by syslog.
   */
  priority?: number
}
/**
 * This section can be used to setup the mdns servers.
 */
export interface Service5 {
  /**
   * This is an array of additional hostnames that the AP shall announce.
   */
  'additional-hostnames'?: string[]
}
/**
 * This section describes the QoS behaviour of the unit.
 */
export interface Service6 {
  /**
   * Automatically detect and classify bulk flows based on average packet size and PPS.
   */
  'bulk-detection'?: {
    /**
     * The DSCP value assigned to packets belonging to a bulk flow.
     */
    dscp?:
      | 'CS0'
      | 'CS1'
      | 'CS2'
      | 'CS3'
      | 'CS4'
      | 'CS5'
      | 'CS6'
      | 'CS7'
      | 'AF11'
      | 'AF12'
      | 'AF13'
      | 'AF21'
      | 'AF22'
      | 'AF23'
      | 'AF31'
      | 'AF32'
      | 'AF33'
      | 'AF41'
      | 'AF42'
      | 'AF43'
      | 'EF'
      | 'VA'
      | 'LE'
    /**
     * The PPS rate that will cause a flow to be classified as bulk.
     */
    'packets-per-second'?: number
  }
  /**
   * A list of predefined named services that shall be classified according to the qos.json database.
   */
  services?: string[]
  /**
   * Custom traffic classifiers. Each entry maps traffic matching its constraints to a DSCP value.
   */
  classifier?: {
    /**
     * The DSCP value to assign to matching packets.
     */
    dscp?:
      | 'CS0'
      | 'CS1'
      | 'CS2'
      | 'CS3'
      | 'CS4'
      | 'CS5'
      | 'CS6'
      | 'CS7'
      | 'AF11'
      | 'AF12'
      | 'AF13'
      | 'AF21'
      | 'AF22'
      | 'AF23'
      | 'AF31'
      | 'AF32'
      | 'AF33'
      | 'AF41'
      | 'AF42'
      | 'AF43'
      | 'EF'
      | 'VA'
      | 'LE'
    /**
     * Layer 3 protocol and port/range match rules.
     */
    ports?: {
      protocol?: 'any' | 'tcp' | 'udp'
      port?: number
      'range-end'?: number
      reclassify?: boolean
    }[]
    /**
     * FQDN wildcard match rules. Resolved IPs are used for packet classification.
     */
    dns?: {
      fqdn?: string
      'suffix-matching'?: boolean
      reclassify?: boolean
    }[]
  }[]
}
/**
 * This section configures the built-in RADIUS server daemon.
 */
export interface Service7 {
  /**
   * The port for RADIUS authentication requests.
   */
  'auth-port'?: number
  /**
   * The port for RADIUS accounting requests.
   */
  'acct-port'?: number
  /**
   * The shared secret for RADIUS clients.
   */
  secret?: string
  /**
   * RADIUS users for authentication.
   */
  users?: {
    [k: string]: ServiceRadiusServer
  }
}
/**
 * A RADIUS user for authentication.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".+".
 */
export interface ServiceRadiusServer {
  /**
   * Authentication type for this user.
   */
  'auth-type'?: 'password' | 'certificate' | 'both'
  /**
   * User password for password-based authentication.
   */
  password?: string
  /**
   * VLAN ID to assign to this user.
   */
  'vlan-id'?: number
  /**
   * Upload rate limit in kbps.
   */
  'rate-limit-upload'?: number
  /**
   * Download rate limit in kbps.
   */
  'rate-limit-download'?: number
}
/**
 * This section can be used to setup a SSH server on the AP.
 */
export interface Service8 {
  /**
   * This option defines which port the SSH server shall be available on.
   */
  port?: number
  /**
   * The port the CLI-over-SSH service shall be available on. This spawns a separate dropbear instance that forces the CLI as the login shell.
   */
  'cli-port'?: number
  /**
   * This allows the upload of public ssh keys. Keys need to be seperated by a newline.
   */
  'authorized-keys'?: string[]
  /**
   * This option defines if password authentication shall be enabled. If set to false, only ssh key based authentication is possible.
   */
  'password-authentication'?: boolean
}
/**
 * This section can be used to configure the Tailscale VPN service
 */
export interface Service9 {
  /**
   * Automatically start the Tailscale tunnel when the device boots
   */
  'auto-start'?: boolean
  /**
   * Advertise this device as an exit node for the Tailnet
   */
  'exit-node'?: boolean
  /**
   * Announce LAN routes to the Tailnet
   */
  'announce-routes'?: boolean
}

export type UconfigDocument = HttpsUconfigOpenwrtOrgUconfigSchemaJson
