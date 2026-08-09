# What the device is doing

Decisions taken 2026-08-09 about the RPCs that report live state, as opposed to
the ones that read and write configuration.

Sources:
- tools/mock-ap/server.py — `m_radios`, `m_ports`, `m_network`, `m_event_log`, `m_memory`
- tools/mock-ap/fixtures.json — `radios`, `ports`, `network`, `event-log`, `memory`
- ../uconfig/modules/state/usr/bin/uconfig-state — the `state` object
- ../uconfig/files/usr/bin/uconfig-event — the `event` object
- /usr/sbin/umemd on the device — the `memory` object, shipped outside the uconfig tree
- ../uconfig/modules/webui/usr/share/ucode/uconfig/uwsd-handler.uc — the bridge
- Mockups: docs/mockups/status-pages.html, docs/mockups/system-diagnostics.html

Everything here was read off a GL-MT6000 at 192.168.42.1. The fixtures carry the
shapes and none of the addresses; see [mock-ap.md](mock-ap.md).

## Configuration is not state

`config-get` says what the device was told to do. None of it says what happened.
Whether the uplink got an address, which channel the radio landed on when it was
told `auto`, whether a cable is in the socket: all absent, and all the first
thing anyone wants when something is wrong.

`live-app-navigation.md` recorded the gap when the Network mockups were drawn:
the lease card on WAN and the channel-in-use panel on Radios were left unbuilt
because nothing returned that data. These three RPCs are what those panels were
waiting for.

## The calls

All top level, all authenticated, none addressed: a device reporting on itself
has nothing to address. Each passes the ubus reply through unchanged.

| RPC | ubus | Returns |
|---|---|---|
| `radios` | `state radios` | operating channel, width, mode and airtime per band |
| `ports` | `state ports` | carrier, speed and counters per socket |
| `network` | `state network` | addresses, gateway, DNS and lease per interface |
| `event-log` | `event log` | the last 100 things that happened |
| `memory` | `memory info` | free memory, and which processes are growing |

All but `network` already exist as ubus objects. `network` does not; it is
specified here and mocked, and the device side is still to write. None of the
five is bridged to the websocket yet.

They come from three different daemons, which matters when one of them is
missing: `state` from `uconfig-mod-state`, `event` from the base uconfig
package, and `memory` from `umemd`, which is not in the uconfig tree at all.
A device can quite reasonably answer three of these and not the other two.

### radios

Keyed by band, the value of `data.config.band` from `network.wireless status`.

```json
"2g": {
  "htmode": "HE20", "channel": "0", "mode": "HE", "bandwidth": "20",
  "active_channel": "11", "freq": 2462, "utilization": 66,
  "bandwidths": ["20", "40"],
  "channels": { "b20": ["1","5","9","13"], "b40": ["1","9"] }
}
```

`channel` is what the config asked for, `"0"` meaning `auto`; `active_channel`
is what the radio picked. Showing both is the point of the page: a device on
`auto` sitting on a channel at 66% airtime is the answer to "why is the wifi
slow", and neither number alone says it.

`utilization` is airtime from `hostapd get_status`, a percentage. `bandwidths`
and `channels` are what this radio may still be moved to, narrowed by regulatory
domain, so a page can offer a change without a second call.

### ports

Keyed `WAN`, `LAN1`…`LAN5`, built from the board's port roles and
`network.device status`. A socket with nothing in it reports `carrier: false`
and `speed: null`.

```json
"LAN2": { "netdev": "lan2", "index": 1, "carrier": true, "speed": "1000",
          "macaddr": "00:00:5e:00:53:11", "rx_bytes": 4052584209, "tx_bytes": 29962764864 }
```

The optional `{network}` argument narrows the reply to the sockets one interface
holds, which the device reads from `/tmp/uconfig/ports.<network>`.

### network

The one being added. Keyed by the interface name in the uconfig document.

```json
"wan": {
  "up": true, "uptime": 102567, "device": "eth1",
  "ipv4": { "proto": "dhcp", "address": "192.0.2.50/24", "gateway": "192.0.2.1",
            "dns": ["192.0.2.1"], "search": ["example.net"],
            "lease": { "server": "192.0.2.1", "time": 864000 } },
  "ipv6": { "proto": "dhcpv6", "addresses": ["2001:db8:1403:600::1dd7/64"],
            "prefix": "2001:db8:1403:6fc::/62" }
}
```

**One document interface is several netifd interfaces.** netifd splits a dual
stack uplink into one section per family, and none of them is named after the
document:

```
config interface 'wan'    proto 'none'     the carrier
config interface 'wan_4'  proto 'dhcp'     the v4 lease
config interface 'wan_6'  proto 'dhcpv6'   the v6 lease and prefix
```

The join is already written down. uconfig stamps every section it generates:

```
config interface 'wan_4'
        option uconfig_name 'wan'
        option uconfig_path '/interfaces/wan'
```

So `network` walks `network.interface dump`, groups by the `uconfig_name` of
each section, and folds the families into one entry. Without that the app would
have to know that `wan_6` is part of `wan`, which is netifd's private business
and changes when the proto changes.

Field by field, from each section's status: `ipv4-address[0]` and its mask;
`route[]` where `target` is `0.0.0.0` gives the gateway; `dns-server[]` and
`dns-search[]`; `data.dhcpserver` and `data.leasetime` for the lease;
`ipv6-address[]`; `ipv6-prefix[]` for what was delegated to us and
`ipv6-prefix-assignment[]` for what we handed on.

### event-log

`/usr/bin/uconfig-event` keeps the last 100 things that happened and hands them
over whole. Every entry is `{object, verb, time, ...payload}` — flat, with the
payload merged in rather than nested, and `time` a unix second count stamped by
the daemon.

```json
{"object": "client", "verb": "join", "time": 1786013972, "medium": "wireless",
 "mac": "00:00:5E:00:53:01", "ssid": "uconfig-demo", "bssid": "00:00:5E:00:53:A1",
 "ifname": "phy1-ap0", "channel": 36, "band": "5G"}
```

What is emitted from the uconfig tree today:

| object | verb | payload |
|---|---|---|
| `client` | `join` | `mac`, `medium`, `ssid`, `bssid`, `ifname`, `channel`, `band`, sometimes `rate-limit` and `vlan` |
| `client` | `leave` | `mac`, `connected_time`, `rx_bytes`, `tx_bytes`, `rx_packets`, `tx_packets` |
| `client` | `key-mismatch` | `mac`, `ssid`, `bssid` |
| `wifi` | `start`, `stop` | `ssid`, `bssid`, `channel`, `band` |
| `wifi` | `channel-switch` | hostapd's payload, passed through unchanged |
| `carrier` | `up`, `down` | `name` |
| `dhcp` | dnsmasq's verb | dnsmasq's payload: `interface`, `ip`, `mac`, `name` |
| `ssh` | `event` | `msg` |

Four things about it decide how the page is built.

**The array is rotated, not sorted.** The daemon writes
`events[event_count % 100]` and `log` returns slot order, so once the buffer has
wrapped it begins in the middle with the oldest entry. Sort by `time`. The
fixture is deliberately stored rotated so a client that forgets looks wrong
against the mock rather than only against a device that has been up long enough.

**Nothing survives a restart.** It is a plain array in the daemon's memory, with
no file behind it. An empty log means the device or the daemon restarted, not
that the network has been quiet, and the page has to say which.

**The vocabulary is open.** The `event` ubus method takes any `object` and
`verb` from any caller, and the `dhcp` verb is whatever dnsmasq's notify says
after the dot — `ack` is simply the one that turns up most. Anything that
renders only the combinations in the table above will silently drop events.

**`band` is already the schema's spelling** (`2G`, `5G`), unlike `radios`. No
case fold here. `carrier`'s `name` is a socket label (`WAN`, `LAN2`) taken from
`board.json`, not an ifname, so it matches `ports` rather than `capabilities`.

There is also a ubus notify channel: subscribers to the `event` object get each
entry as it happens. Nothing uses it, and polling `log` is enough at this size,
but it is the way out if the log ever needs to be live.

### memory

`/usr/sbin/umemd`, a ucode daemon in its own package. Returns free memory and
every process it is watching, split in two.

```json
{
  "system": {"total_kb": 1008756, "free_kb": 615416, "available_kb": 665980,
             "buff_cache_kb": 119356, "swap_total_kb": 0, "swap_free_kb": 0},
  "leaking": [{"pid": 5244, "cmd": "ucode", "age_s": 113921, "rss_kb": 32740,
               "rss_startup_kb": 1612, "rss_delta_kb": 31128,
               "fds": 25, "fds_startup": 19, "fds_delta": 6}],
  "stable": [ ... ]
}
```

**`leaking` does not mean leaking.** The entire rule is
`if (delta_rss > 0 || delta_fds > 0)`. Any growth at all, by any amount, puts a
process in that list: on the device this was read from, 18 of 44 processes are
flagged and the last of them has grown by 8 kB. Repeating the word in the UI
would report eleven leaking daemons where there are none, so the page says
**grown since first seen** and **steady**, shows the actual figure, and lets the
number carry the argument. The split is still worth keeping — it is the sort
key, and everything above the fold really is what grew.

**The two halves are not the same age.** `system` is read from `/proc/meminfo`
when the call arrives, so it is live. The process lists come from a table
resampled on `REFRESH_MS`, which is **one hour**. Polling faster than that draws
a frozen table beside a moving gauge; poll this at 60s and say on the page that
the per-process figures are hourly.

**`startup` is when umemd first saw the process, not when it started.** New pids
are picked up by a 60 second scan, so anything already running when umemd
started is baselined at umemd's first sweep. `rss_startup_kb` for a boot-time
daemon means "RSS shortly after boot", and `age_s` is how long it has been
watched. After a umemd respawn every baseline resets and the whole list reads
steady for an hour.

Sorting is the daemon's and worth keeping: `leaking` by `rss_delta_kb`
descending, `stable` by `rss_kb` descending.

`system` overlaps `system-info`, which the Overview page already draws — but in
different units (kB against bytes) and sampled at a different instant. A page
should read one or the other, never both, or it will show two different totals.

## Who reads them

`src/lib/netstate.svelte.ts` holds one store per call, refreshed on a ten second
poll through the `poll_feed()` registry, plus the three derivations the pages
share: `uplink()`, `local()` and `sorted_ports()`.

| Page | Component | Feeds |
|---|---|---|
| Status › Internet | `InternetPage.svelte` | `network`, `ports`, `traffic` |
| Status › Network | `WiredPage.svelte` | `network`, `ports`, `clients` |
| Status › Wireless | `AirtimePage.svelte` | `radios`, `clients` |
| System › Events | drawn, not built | `event-log`, `clients` |
| System › Memory | drawn, not built | `memory` |

The Events page reads `clients` as well because the log records MACs and people
read names. `devices` is the only thing that maps one to the other, so a log
line for a device that has never been seen shows its MAC and nothing more —
which is exactly right for the `key-mismatch` entries, since a device failing
the passphrase never gets far enough to appear in `devices` at all.

Relative times on that page should be measured against `sysinfo.data.localtime`
rather than the browser clock. Both timestamps come from the device, and a
device with no working NTP is skewed against the browser but consistent with
itself.

`uplink()` deserves a note. It looks for a gateway first, but an uplink that has
lost its lease has none, and that is the state these pages exist to explain, so
it falls back to an addressing protocol that goes upstream (`dhcp`, `pppoe`,
`wwan` and the rest) and then to the name `wan`. Everything not the uplink is
local, so getting this wrong puts a dead WAN on the Network page as a stray
interface with no address.

Per-radio client counts are not in `radios`. The Wireless page counts them by
grouping `devices` on `wifi.band`, folding case to bridge `2g` and `2G`. The
device could report them directly and save the join.

## What is broken on the device

Two things, both in `../uconfig`, neither fixed here.

**The bridge calls an object that does not exist.** `handle_radios` and
`handle_traffic` call `ubus.call('uconfig-ui', …)`, but `uconfig-state` publishes
`state`. On the device:

```
# ubus call uconfig-ui radios
Command failed: Not found
```

So `radios` and `traffic` fail over the websocket today. The mock is written
against what the ubus object really returns, so the app is correct once the
bridge names `state`.

**`ports` has no bridge at all**, and `state network` does not exist yet.
`uconfig-state` even has a `network_interfaces()` helper, but only uses it
privately to map `l3_device` back to an interface name for the client list.

**`event log` and `memory info` have no bridge either.** Both ubus objects work
today; nothing in `uwsd-handler.uc` calls them. Each needs a `handle_<name>`
following `handle_traffic` and one line in the `handlers` table. `memory` also
needs the bridge to survive the object being absent, since `umemd` is a separate
package and a device without it should report a missing feature rather than an
internal error.

## Two names for one thing

Worth knowing before joining these payloads to anything.

- **Bands.** `radios` keys on `data.config.band` and returns `2g` and `5g`. The
  schema, `capabilities.wiphy[].bands` and the `devices` reply all use `2G` and
  `5G`. Anything matching a radio to its config has to fold case.
- **Ports.** `ports` returns `WAN` and `LAN1`…`LAN5`; `capabilities` returns
  `eth1` and `lan1`…`lan5`, which is what the Ports config page uses. The
  `netdev` field carries the second name, so the join exists, but the two
  vocabularies are visible to the user in different places.
