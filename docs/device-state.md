# What the device is doing

Decisions taken 2026-08-09 about the RPCs that report live state, as opposed to
the ones that read and write configuration.

Sources:
- tools/mock-ap/server.py — `m_radios`, `m_ports`, `m_network`, `PORTS_BY_NETWORK`
- tools/mock-ap/fixtures.json — `radios`, `ports`, `network`
- ../uconfig/modules/state/usr/bin/uconfig-state — the ubus object behind them
- ../uconfig/modules/webui/usr/share/ucode/uconfig/uwsd-handler.uc — the bridge
- Mockups: docs/mockups/status-pages.html

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

## The three calls

All top level, all authenticated, none addressed: a device reporting on itself
has nothing to address.

| RPC | ubus | Returns |
|---|---|---|
| `radios` | `state radios` | operating channel, width, mode and airtime per band |
| `ports` | `state ports` | carrier, speed and counters per socket |
| `network` | `state network` | addresses, gateway, DNS and lease per interface |

`radios` and `ports` already exist on the device. `network` does not; it is
specified here and mocked, and the device side is still to write.

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

## Who reads them

`src/lib/netstate.svelte.ts` holds one store per call, refreshed on a ten second
poll through the `poll_feed()` registry, plus the three derivations the pages
share: `uplink()`, `local()` and `sorted_ports()`.

| Page | Component | Feeds |
|---|---|---|
| Status › Internet | `InternetPage.svelte` | `network`, `ports`, `traffic` |
| Status › Network | `WiredPage.svelte` | `network`, `ports`, `clients` |
| Status › Wireless | `AirtimePage.svelte` | `radios`, `clients` |

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

## Two names for one thing

Worth knowing before joining these payloads to anything.

- **Bands.** `radios` keys on `data.config.band` and returns `2g` and `5g`. The
  schema, `capabilities.wiphy[].bands` and the `devices` reply all use `2G` and
  `5G`. Anything matching a radio to its config has to fold case.
- **Ports.** `ports` returns `WAN` and `LAN1`…`LAN5`; `capabilities` returns
  `eth1` and `lan1`…`lan5`, which is what the Ports config page uses. The
  `netdev` field carries the second name, so the join exists, but the two
  vocabularies are visible to the user in different places.
