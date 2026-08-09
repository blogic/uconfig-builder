# uconfig web UI websocket — live-state RPC API

Specification for five JSON-RPC methods that report what the device is doing, as
opposed to what it was configured to do. Self-contained: everything needed to
implement them in the `uconfig` firmware tree is below.

The browser side is already written against this contract. Where an
implementation choice would change the wire format, the reason it was made that
way is given, because the client depends on it.

---

## 1. Transport

Unchanged from the existing methods; repeated here so this document stands alone.

- **Protocol:** JSON-RPC 2.0 over a websocket, subprotocol `ui`.
- **Handler:** `modules/webui/usr/share/ucode/uconfig/uwsd-handler.uc`.
- **Sequence:** the server sends a `login-required` notification ~200 ms after
  the socket opens (or `setup-required` on an unconfigured device); the client
  calls `login`, then anything else.

Request:

```json
{ "jsonrpc": "2.0", "id": 7, "method": "network", "params": {} }
```

Success:

```json
{ "jsonrpc": "2.0", "id": 7, "result": { "...": "..." } }
```

Failure:

```json
{ "jsonrpc": "2.0", "id": 7, "error": { "code": -32603, "message": "..." } }
```

### Error codes

Defined in `modules/webui/usr/share/ucode/uconfig/uwsd/jsonrpc.uc`:

| Constant | Code | When |
|---|---|---|
| `ERROR_PARSE` | -32700 | malformed JSON |
| `ERROR_INVALID_REQUEST` | -32600 | not a valid JSON-RPC request |
| `ERROR_METHOD_NOT_FOUND` | -32601 | unknown method, **and** a feature the device does not have |
| `ERROR_INVALID_PARAMS` | -32602 | params present but wrong |
| `ERROR_INTERNAL` | -32603 | the backing call failed |
| `ERROR_LOGIN_REQUIRED` | -32001 | not authenticated; message is `login-required` |
| `ERROR_INVALID_PASSWORD` | -32000 | `login` only |

Two behaviours the client relies on:

- **All five methods are `auth_required: true`.** An unauthenticated call gets
  -32001 with message `login-required`, which the client treats as a session
  expiry and re-prompts.
- **A missing *feature* is -32601, not -32603.** These methods are backed by
  three different daemons from three different packages, so a device can
  legitimately answer four of them and not the fifth. -32603 tells the client
  "this broke"; -32601 tells it "this device cannot do that", which is the
  difference between an error banner and a page that says so calmly.

### Addressing

All five are **top level** and take no peer address. Only the venue-scoped
ucoord methods (`peer-config-get`, `peer-config-apply`, `peer-info`) carry
`venue`/`peer`. A device reporting on itself has nothing to address.

### Method summary

| Method | Params | Backed by | Client poll |
|---|---|---|---|
| `radios` | none | `ubus call state radios` | 10 s |
| `ports` | `{network?}` | `ubus call state ports` | 10 s |
| `network` | none | `ubus call state network` **(new)** | 10 s |
| `event-log` | none | `ubus call event log` | 10 s |
| `memory` | none | `ubus call memory info` | 60 s |

Every method returns the ubus reply **verbatim**. No reshaping, no filtering, no
sorting in the bridge. The sections below are therefore both the wire contract
and the ubus contract.

---

## 2. `radios`

Operating state per radio: what the radio landed on, against what it was asked
for, and how busy the air is.

**Params:** none.

**Result:** an object keyed by band. The key is `data.config.band` from
`network.wireless status`, lowercased by the source.

```json
{
  "2g": {
    "htmode": "HE20",
    "channel": "0",
    "mode": "HE",
    "bandwidth": "20",
    "active_channel": "11",
    "freq": 2462,
    "utilization": 66,
    "bandwidths": ["20", "40"],
    "channels": { "b20": ["1", "5", "9", "13"], "b40": ["1", "9"] }
  },
  "5g": {
    "htmode": "HE80",
    "channel": "36",
    "mode": "HE",
    "bandwidth": "80",
    "active_channel": "36",
    "freq": 5180,
    "utilization": 11,
    "bandwidths": ["20", "40", "80", "160"],
    "channels": { "b20": ["36", "40", "44", "48"], "b80": ["36"] }
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `channel` | string | What the config asked for. **`"0"` means automatic.** |
| `active_channel` | string | What the radio actually landed on. |
| `bandwidth` | string | Channel width in MHz. |
| `htmode` | string | e.g. `HE20`, `HE80`. |
| `mode` | string | `EHT`, `HE`, `VHT`, `HT` — the 802.11 generation. |
| `freq` | number | Centre frequency in MHz. |
| `utilization` | number | Airtime in use, 0–100. |
| `bandwidths` | string[] | Widths this radio supports. |
| `channels` | object | Usable channels per width, keyed `b20`, `b40`, `b80`, `b160`. |

**Notes**

- `channel` versus `active_channel` is the whole point of the call. A radio told
  `auto` that landed on 11 reports `channel: "0"`, `active_channel: "11"`, and
  the UI says "chosen automatically". Do not collapse the two.
- **Band key case.** These keys are lowercase (`2g`, `5g`) while the schema,
  `capabilities.wiphy[].bands` and the `devices` reply all use `2G`/`5G`. The
  client folds case to bridge it. Emitting the schema's spelling would be
  better, but it is a breaking change for anything already consuming this.
- No per-radio client count. The client derives one by grouping `devices` on
  `wifi.band`. Adding a count here would save that join.

---

## 3. `ports`

Physical socket state: carrier, negotiated speed, byte counters.

**Params:** optional.

| Param | Type | Meaning |
|---|---|---|
| `network` | string | Narrow to the sockets one network holds. Omit for all. |

Pass the parameter through only when present, so a client that omits it gets
every socket.

**Result:** an object keyed by socket label.

```json
{
  "WAN":  { "netdev": "eth1", "index": 0, "carrier": true,  "speed": "1000",
            "macaddr": "94:83:c4:a3:1d:d8",
            "rx_bytes": 30227177075, "tx_bytes": 4032852192 },
  "LAN1": { "netdev": "lan1", "index": 0, "carrier": false, "speed": null,
            "macaddr": "94:83:c4:a3:1d:d9",
            "rx_bytes": 0, "tx_bytes": 0 },
  "LAN2": { "netdev": "lan2", "index": 1, "carrier": true,  "speed": "1000",
            "macaddr": "94:83:c4:a3:1d:d9",
            "rx_bytes": 4103293011, "tx_bytes": 30161500285 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `netdev` | string | Kernel interface name. |
| `index` | number | Position on the case, for ordering. |
| `carrier` | boolean | Is anything plugged in. |
| `speed` | string \| null | Negotiated Mbit/s. **`null` when there is no carrier.** |
| `macaddr` | string | Port MAC. Shared across switch ports on many devices. |
| `rx_bytes` / `tx_bytes` | number | Counters since boot. |

**Notes**

- Key naming: a single WAN port is `WAN`; multiple ports of a role are
  `LAN1`…`LAN5`, numbered from `index`.
- **Two names for one socket.** Keys here are `WAN`/`LAN1`; `capabilities`
  returns `eth1`/`lan1`, which is what the Ports config page uses. `netdev`
  carries the second name so the join is possible, but both vocabularies are
  visible to the user in different places.
- `speed: null` with `carrier: false` is the normal unplugged state and must not
  be reported as an error.
- Filtering by `network` reads `/tmp/uconfig/ports.<network>`. **A name with no
  such file yields the full port list, not an empty one** — the filter is only
  applied when the file parsed. Verified on a lab AP that writes no such file:
  `ports {"network":"main"}` returned both WAN and LAN. A client cannot treat
  the filtered reply as authoritative for "which sockets does this network
  hold".

---

## 4. `network` — new

Addressing per **document** interface: what the uplink was actually given, and
what the local networks are using.

**Params:** none.

**Result:** an object keyed by the interface name as the uconfig document spells
it (`wan`, `main`, `guest`), not as netifd spells it.

```json
{
  "wan": {
    "up": true,
    "uptime": 108245,
    "device": "eth1",
    "ipv4": {
      "proto": "dhcp",
      "address": "192.168.178.50/24",
      "gateway": "192.168.178.1",
      "dns": ["192.168.178.1"],
      "search": ["fritz.box"],
      "lease": { "server": "192.168.178.1", "time": 864000 }
    },
    "ipv6": {
      "proto": "dhcpv6",
      "addresses": ["fd67:a349:cf3c:0:9683:c4ff:fea3:1dd7/64",
                    "2a04:4540:1403:600:9683:c4ff:fea3:1dd7/64"],
      "prefix": "2a04:4540:1403:6fc::/62"
    }
  },
  "main": {
    "up": true,
    "uptime": 108248,
    "device": "br-lan1v0",
    "ipv4": { "proto": "static", "address": "192.168.42.1/24" },
    "ipv6": { "proto": "static",
              "assigned": ["2a04:4540:1403:6fc::1/64", "fd57:7b6:8da7::1/64"] }
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `up` | boolean | Interface is up. |
| `uptime` | number | Seconds since it came up. |
| `device` | string | L3 device carrying it. |
| `ipv4.proto` | string | `dhcp`, `static`, `pppoe`, … |
| `ipv4.address` | string | `addr/prefixlen`. Absent when unaddressed. |
| `ipv4.gateway` | string | Next hop of the default route. Absent when there is none. |
| `ipv4.dns` | string[] | Resolvers learned or configured. |
| `ipv4.search` | string[] | DNS search domains. |
| `ipv4.lease.server` | string | Which DHCP server answered. |
| `ipv4.lease.time` | number | Lease duration in seconds. |
| `ipv6.proto` | string | `dhcpv6`, `static`, … |
| `ipv6.addresses` | string[] | Each `addr/prefixlen`. |
| `ipv6.prefix` | string | The prefix delegated **to us**. |
| `ipv6.assigned` | string[] | What this interface **put on the wire** out of a delegation. |

Every field except `up`, `uptime` and `device` is optional. An interface with no
address emits `ipv4: { "proto": "dhcp" }` and nothing else, and that is a
meaningful state, not an error: it is exactly "the link is up but nothing has
handed us an address". Do not synthesise empty strings or zeros to fill it in.

`prefix` and `assigned` are deliberately separate. A delegation that arrived but
was never assigned to a local interface is a different fault from one that never
arrived, and only having both fields lets the UI tell them apart.

### Why this method has to be written

The other four already exist as ubus methods. This one does not, because the
underlying data is not in the shape anyone else needed.

**One document interface is several netifd interfaces.** netifd splits a
dual-stack uplink into one section per address family, and names none of them
after the document:

```
wan     proto=none     up=true   dev=eth1     <- the carrier
wan_4   proto=dhcp     up=true   dev=eth1     <- the v4 lease
wan_6   proto=dhcpv6   up=true   dev=eth1     <- the v6 lease and prefix
main    proto=static   up=true   dev=br-lan1v0
```

The join is already on disk: uconfig stamps every section it generates, and
uci's default cursor exposes the stamp because `/var/run/uci` is the default
`config2_dir` override.

```
# uci show network | grep uconfig_name
network.wan.uconfig_name='wan'
network.wan_4.uconfig_name='wan'
network.wan_6.uconfig_name='wan'
network.main.uconfig_name='main'
```

Grouping `network.interface dump` by `uconfig_name` is what turns netifd's view
back into the document's vocabulary. It also drops `loopback`, `tailscale`,
`ucoord_home` and `wan_none` for free, since none of them carries the stamp.

### Field sources

| Output | netifd source |
|---|---|
| `up`, `uptime` | the section whose name **equals** `uconfig_name` (the carrier) |
| `device` | that section's `l3_device`, falling back to `device` |
| `ipv4.address` | `ipv4-address[0].address` + `/` + `.mask` |
| `ipv4.gateway` | `route[]` where `target == "0.0.0.0"` and `mask == 0` → `nexthop` |
| `ipv4.dns`, `ipv4.search` | `dns-server[]`, `dns-search[]` |
| `ipv4.lease` | `data.dhcpserver`, `data.leasetime` |
| `ipv6.addresses` | `ipv6-address[]`, each `address/mask` |
| `ipv6.prefix` | `ipv6-prefix[0].address/mask` |
| `ipv6.assigned` | `ipv6-prefix-assignment[].local-address.address/mask` |
| `proto` | the contributing section's `proto` |

`up`/`uptime` come from the carrier rather than whichever section is iterated
last because the numbers genuinely differ: on a live device `wan.uptime` was
108245, `wan_4` 108242 and `wan_6` 45547. The carrier is the one that answers
"how long has this been up".

---

## 5. `event-log`

The last 100 things the device did.

**Params:** none.

**Result:**

```json
{ "log": [
  { "object": "client", "verb": "join", "time": 1786013972,
    "medium": "wireless", "mac": "00:00:5E:00:53:01", "ssid": "uconfig-demo",
    "bssid": "00:00:5E:00:53:A1", "ifname": "phy1-ap0",
    "channel": 36, "band": "5G" },
  { "object": "dhcp", "verb": "ack", "time": 1786013976,
    "interface": "br-lan1v0", "ip": "192.168.42.10",
    "mac": "00:00:5E:00:53:01", "name": "studio-laptop" }
] }
```

Every entry is `{object, verb, time, ...payload}` — **flat**, with the payload
merged into the same object rather than nested under a key.

| Field | Type | Meaning |
|---|---|---|
| `object` | string | What emitted it. |
| `verb` | string | What it did. |
| `time` | number | Unix seconds, stamped by the daemon from the device clock. |
| …rest | mixed | Per-verb payload, merged in flat. |

### Vocabulary

| object | verb | payload |
|---|---|---|
| `client` | `join` | `mac`, `medium`, `ssid`, `bssid`, `ifname`, `channel`, `band`, sometimes `rate-limit` and `vlan` |
| `client` | `leave` | `mac`, `connected_time`, `rx_bytes`, `tx_bytes`, `rx_packets`, `tx_packets` |
| `client` | `key-mismatch` | `mac`, `ssid`, `bssid` |
| `wifi` | `start`, `stop` | `ssid`, `bssid`, `channel`, `band` |
| `wifi` | `channel-switch` | hostapd's payload, forwarded unchanged — no fixed shape |
| `carrier` | `up`, `down` | `name` |
| `dhcp` | dnsmasq's verb | dnsmasq's payload: `interface`, `ip`, `mac`, `name` |
| `ssh` | `event` | `msg` |

- `medium` is `wireless`, `wired` or `unknown`.
- `band` is `2G`/`5G`/`6G` — already the schema's spelling here, unlike `radios`.
- `carrier`'s `name` is a **socket label** (`WAN`, `LAN2`), matching `ports`
  rather than `capabilities`.
- `rate-limit` is hyphenated, not `rate_limit`, and is optional.

### Four properties the client depends on

**The array is rotated, not sorted.** The ring buffer is written as
`events[event_count % 100]` and the `log` method returns slot order, so once it
has wrapped the array begins in the middle with the *oldest* entry. **The bridge
must not sort it.** The client sorts by `time`, and the mock server serves it
deliberately rotated to keep that path exercised. Sorting here would hide a
client bug until it reached a device.

**Nothing persists.** The buffer is a plain array in the daemon's memory with no
file behind it. A reboot, or procd respawning the daemon, empties it. An empty
log therefore means "the device restarted", not "the network has been quiet",
and the UI says so. Do not fabricate entries to fill it.

**The vocabulary is open.** The `event` ubus method accepts any `object` and
`verb` from any caller, and the dhcp verb is whatever dnsmasq emits after the
dot — `ack` is merely the most common. **Do not filter to a known list.** The
client renders unrecognised combinations by printing the object, verb and
remaining fields; an entry dropped in the bridge is invisible everywhere.

**The timestamps are the device's clock**, which is also where `system-info`'s
`localtime` comes from. The client measures relative ages against `localtime`
rather than the browser clock so that a device with no working NTP is at least
self-consistent. Do not rewrite `time` into anything else.

### Optional future: push instead of poll

The `event` ubus object supports subscription and notifies each entry as it
happens, shaped `{ type: 'event', data: <entry> }`. Nothing uses it. Polling
`log` is adequate at a hundred entries, but a page left open while someone walks
a client around the building would rather have the push. If that is ever wired
up, the notification name should follow the existing convention
(`config-apply-start`, `login-required`, …).

---

## 6. `memory`

Free memory, and which processes have grown.

**Params:** none.

**Result:**

```json
{
  "system": {
    "total_kb": 1008756, "free_kb": 615416, "available_kb": 665980,
    "buff_cache_kb": 119356, "swap_total_kb": 0, "swap_free_kb": 0
  },
  "leaking": [
    { "pid": 5244, "cmd": "ucode", "age_s": 113921,
      "rss_kb": 32740, "rss_startup_kb": 1612, "rss_delta_kb": 31128,
      "fds": 25, "fds_startup": 19, "fds_delta": 6 }
  ],
  "stable": [
    { "pid": 3980, "cmd": "/usr/sbin/tailscaled", "age_s": 113921,
      "rss_kb": 44304, "rss_startup_kb": 56688, "rss_delta_kb": -12384,
      "fds": 21, "fds_startup": 21, "fds_delta": 0 }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `system.total_kb` | number | Total RAM. |
| `system.free_kb` | number | Wholly unused. |
| `system.available_kb` | number | Free plus reclaimable — the useful figure. |
| `system.buff_cache_kb` | number | Buffers plus cache. |
| `system.swap_total_kb` / `swap_free_kb` | number | Both 0 when no swap is configured. |
| `pid` | number | Process id. |
| `cmd` | string | argv[0]. May be a bare name (`ucode`) or a full path. |
| `age_s` | number | How long the daemon has **watched** it. Not process uptime. |
| `rss_kb` | number | Resident set size now. |
| `rss_startup_kb` | number | RSS at first sighting. |
| `rss_delta_kb` | number | `rss_kb - rss_startup_kb`. **May be negative.** |
| `fds` / `fds_startup` / `fds_delta` | number | Open file descriptors, same three forms. |

### Three properties that shaped the UI

These are stated so nobody "improves" the bridge in a way that breaks the
client's reading of the data.

**`leaking` does not mean leaking.** The entire rule is
`if (rss_delta_kb > 0 || fds_delta > 0)`. Any growth at all, by any amount. On a
healthy device this flags 18 of 44 processes, the last of them by 8 kB. The UI
therefore labels the two lists **"grown since first seen"** and **"steady"** and
prints the actual figure; it never uses the word "leaking". Note that `stable`
consequently holds processes that *shrank* — the `tailscaled` example above is
12 MB smaller than at first sighting.

**The two halves are different ages.** `system` is read from `/proc/meminfo` at
call time, so it is live. The process lists come from a table resampled on a
**one hour** interval. This is why the client polls this method at 60 s rather
than the 10 s it uses for the others: polling faster would redraw a frozen table
beside a moving gauge.

**"Startup" is the watcher's first sighting, not the process's start.** New pids
are discovered by a 60 s scan, so anything already running when the daemon
started is baselined at its first sweep. `rss_startup_kb` for a boot-time daemon
means "RSS shortly after boot", and after a watcher restart every baseline
resets and the whole list reads steady for an hour.

### Sorting

`leaking` descending by `rss_delta_kb`; `stable` descending by `rss_kb`. The
client renders in the order received and shows the top eight of each, so this
ordering is load-bearing. **Do not re-sort in the bridge.**

### When the feature is absent

The `memory` ubus object comes from a package outside the `uconfig` tree, so
some builds will not have it. Return **`ERROR_METHOD_NOT_FOUND` (-32601)** with
a readable message in that case, not -32603. The client shows "this device does
not report memory" rather than an error banner.

### Suggested addition at the source

The payload never says *when* the process figures were taken, so the UI can say
"sampled hourly" but not "sampled 11 minutes ago". One `sampled_at` unix
timestamp alongside `system` would fix that. Likewise there is no process start
time, so `age_s` cannot be turned into real process uptime.

---

## 7. Implementation

### 7.1 Prerequisite: two handlers call an object that does not exist

**File:** `modules/webui/usr/share/ucode/uconfig/uwsd-handler.uc`

`handle_radios` and `handle_traffic` call `ubus.call('uconfig-ui', …)`. The
publisher is `state`; `uconfig-ui` is not present on a current device:

```
# ubus call uconfig-ui radios
Command failed: Not found
```

So `radios` and `traffic` fail over the websocket today. Change the object name
in both:

```ucode
	let radios = ubus.call('state', 'radios');
```

```ucode
	let traffic = ubus.call('state', 'traffic');
```

The reply is passed straight through, so no client change follows.

The same stale name appears in five more places, which are the same bug and will
surface next: `uwsd/status.uc:85`, `uwsd/devices.uc:13,23,37,51`,
`uwsd/wizard.uc:56`. Sweeping them is the honest fix; the risk is that those two
modules have their own behaviour to re-test.

### 7.2 The `network` ubus method

**File:** `modules/state/usr/bin/uconfig-state`

Add the `uci` import at the top, beside the existing ones — the file does not
currently import it:

```ucode
import * as uci from 'uci';
```

ucode does not hoist, so these three functions must appear **textually before**
`ubus_methods`. Put them next to `ports()`, the closest neighbour in shape.

```ucode
function ipv4_state(iface) {
	let rv = {};
	let has;

	let addrs = iface['ipv4-address'] ?? [];
	if (length(addrs)) {
		rv.address = `${addrs[0].address}/${addrs[0].mask}`;
		has = true;
	}

	for (let route in iface.route ?? []) {
		if (route.target != '0.0.0.0' || route.mask != 0)
			continue;
		rv.gateway = route.nexthop;
		has = true;
		break;
	}

	let dns = iface['dns-server'] ?? [];
	if (length(dns)) {
		rv.dns = dns;
		has = true;
	}

	let search = iface['dns-search'] ?? [];
	if (length(search)) {
		rv.search = search;
		has = true;
	}

	if (iface.data?.dhcpserver) {
		rv.lease = {
			server: iface.data.dhcpserver,
			time: iface.data.leasetime,
		};
		has = true;
	}

	if (!has)
		return null;

	rv.proto = iface.proto;
	return rv;
}

function ipv6_state(iface) {
	let rv = {};
	let has;

	let addrs = iface['ipv6-address'] ?? [];
	if (length(addrs)) {
		rv.addresses = map(addrs, (a) => `${a.address}/${a.mask}`);
		has = true;
	}

	let prefixes = iface['ipv6-prefix'] ?? [];
	if (length(prefixes)) {
		rv.prefix = `${prefixes[0].address}/${prefixes[0].mask}`;
		has = true;
	}

	// What this interface put on the wire out of a delegation, as opposed to
	// the prefix it was handed. A delegation that arrived but was never
	// assigned is a different fault from one that never arrived.
	let local = [];
	for (let a in iface['ipv6-prefix-assignment'] ?? []) {
		if (!a['local-address'])
			continue;
		push(local, `${a['local-address'].address}/${a['local-address'].mask}`);
	}
	if (length(local)) {
		rv.assigned = local;
		has = true;
	}

	if (!has)
		return null;

	rv.proto = iface.proto;
	return rv;
}

function network() {
	let dump = ubus.call('network.interface', 'dump');
	if (!dump)
		return {};

	// netifd splits one document interface into a section per address family
	// and names none of them after the document, so the uconfig_name stamp is
	// the only reliable way back.
	let cursor = uci.cursor();
	if (!cursor)
		return {};

	let owner = {};

	cursor.load('network');
	cursor.foreach('network', 'interface', (s) => {
		if (s.uconfig_name)
			owner[s['.name']] = s.uconfig_name;
	});

	let rv = {};

	for (let iface in dump.interface) {
		let name = owner[iface.interface];
		if (!name)
			continue;

		rv[name] ??= {};
		let entry = rv[name];

		// The section named after the document interface is the carrier: it
		// owns the device and the uptime, while the per-family sections come
		// and go with their leases.
		if (iface.interface == name) {
			entry.up = iface.up;
			entry.uptime = iface.uptime;
			entry.device = iface.l3_device ?? iface.device;
		}

		let v4 = ipv4_state(iface);
		if (v4)
			entry.ipv4 = { ...(entry.ipv4 ?? {}), ...v4 };

		let v6 = ipv6_state(iface);
		if (v6)
			entry.ipv6 = { ...(entry.ipv6 ?? {}), ...v6 };
	}

	return rv;
}
```

Register it in `ubus_methods`, beside `ports` and `radios`:

```ucode
	network: {
		call: function(req) {
			return network();
		},
		args: {
		}
	},
```

### 7.3 The four bridge handlers

**File:** `modules/webui/usr/share/ucode/uconfig/uwsd-handler.uc`

The dispatcher is generic, so each method needs exactly two things: a handler
function and one line in the `handlers` table. The file is indented with
**tabs**, and every error constant used below is already in the import block at
the top.

Add these beside `handle_traffic`, before the `handlers` table:

```ucode
function handle_ports(connection, id, params) {
	// The ubus method optionally narrows to the sockets one network holds.
	// Forward the filter only when the client sends one, so a client that
	// omits it gets every socket.
	let args = {};
	if (type(params) == 'object' && params.network)
		args.network = params.network;

	let ports = ubus.call('state', 'ports', args);

	if (!ports)
		return send_response(connection, response_error(id, ERROR_INTERNAL, 'Failed to retrieve port information'));

	send_response(connection, response_success(id, ports));
}

function handle_network(connection, id, params) {
	let network = ubus.call('state', 'network');

	if (!network)
		return send_response(connection, response_error(id, ERROR_INTERNAL, 'Failed to retrieve network information'));

	send_response(connection, response_success(id, network));
}

function handle_event_log(connection, id, params) {
	let log = ubus.call('event', 'log');

	if (!log)
		return send_response(connection, response_error(id, ERROR_INTERNAL, 'Failed to retrieve the event log'));

	send_response(connection, response_success(id, log));
}

function handle_memory(connection, id, params) {
	// The memory watcher ships outside this tree, so the object is genuinely
	// absent on some builds. That is a missing feature rather than a failure,
	// and the client draws the two differently.
	let memory = ubus.call('memory', 'info');

	if (!memory)
		return send_response(connection, response_error(id, ERROR_METHOD_NOT_FOUND, 'Memory reporting is not installed on this device'));

	send_response(connection, response_success(id, memory));
}
```

Then, in the `handlers` table after `'traffic'`:

```ucode
	'ports': { handler: handle_ports, auth_required: true },
	'network': { handler: handle_network, auth_required: true },
	'event-log': { handler: handle_event_log, auth_required: true },
	'memory': { handler: handle_memory, auth_required: true },
```

### 7.4 ucode notes

The language is not JavaScript. The traps that apply to the code above:

- **No hoisting.** Every function must be textually defined before anything
  references it, including references inside other function bodies.
- **No destructuring.** `let {a, b} = obj` is a syntax error.
- Hyphenated keys need bracket access: `iface['ipv4-address']`, never
  `iface.ipv4-address`.
- Global functions, not methods: `length(x)`, `push(a, v)`, `map(a, fn)`. There
  is no `a.push()`.
- `??=`, `?.` and object spread are all supported and used above.
- `ubus.call(object, method, data)` — the positional form used throughout this
  tree. The named-object form exists; nothing here uses it.
- `ubus.call()` is synchronous and blocks the event loop, which deadlocks if the
  target is published by the **same process**. It is not here: `state`, `event`
  and `memory` are separate daemons. If any of them ever moves into `uwsd`,
  these must become `ubus.defer()`.

---

## 8. Verification

### ubus layer

```sh
ubus call state radios
ubus call state ports
ubus call state ports '{"network":"main"}'   # WAN must be absent
ubus call state network                      # compare with section 4
ubus call event log
ubus call memory info
```

### Websocket layer

Connect with subprotocol `ui`, wait for `login-required`, call `login`, then
each method. The checks worth making explicitly, because each maps to a real
trap:

| Check | Why |
|---|---|
| `event-log` array is **not** in `time` order on a device up long enough to wrap 100 events | proves nothing in the chain is sorting it |
| `memory.leaking` is descending by `rss_delta_kb`, and every entry has `rss_delta_kb > 0` or `fds_delta > 0` | proves the daemon's order survived |
| `memory.stable` contains at least one negative `rss_delta_kb` on a long-running device | proves "stable" is not being filtered to zero-delta |
| `network` keys are document names only; `loopback`, `tailscale`, `ucoord_home`, `wan_none` absent | proves the `uconfig_name` join, not a name-prefix guess |
| `network.wan.uptime` ≥ the per-family sections' | proves `up`/`uptime` come from the carrier |
| `ports` with `{"network":"main"}` excludes WAN | proves the filter is forwarded |
| unauthenticated call returns -32001 `login-required` | all five are `auth_required` |
| `memory` on a build without the watcher returns -32601, not -32603 | missing feature vs failure |

---

## 9. Checklist

- [ ] `handle_radios` and `handle_traffic` call `state`, not `uconfig-ui`
- [ ] Decide whether to sweep the other five `uconfig-ui` references
- [ ] `import * as uci from 'uci';` added to `uconfig-state`
- [ ] `ipv4_state`, `ipv6_state`, `network` defined **before** `ubus_methods`
- [ ] `network` registered in `ubus_methods`
- [ ] `ubus call state network` matches section 4
- [ ] Four handlers added and registered, all `auth_required: true`
- [ ] `memory` returns -32601 when the watcher is absent
- [ ] Event log left unsorted and unfiltered
- [ ] Memory lists left in the daemon's order
- [ ] All five answer over the websocket after a restart
