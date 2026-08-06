# Mock AP

A local stand-in for the ucoord websocket server on an access point, so new
JSON-RPC methods can be developed without touching a device.

Sources:
- tools/mock-ap/server.py
- ../uconfig/modules/ucoord/usr/share/ucode/ucoord/uwsd-handler.uc (the real one)
- src/lib/connection.svelte.ts (what the client expects)

```
npm run mock
```

Serves `ws://localhost:8080/uconfig`. Connect the UI to `localhost:8080` with
password `a`, exactly as if it were a device.

## Why

The GL-MT6000 is read-only by standing rule, and putting a new RPC on a device
means editing ucode and reflashing. Prototyping here and porting to
`uwsd-handler.uc` afterwards is faster and cannot break hardware.

It also makes the first-boot flow repeatable. The intended sequence is: an AP
ships a minimal config, the UI sees no top-level `webui` object and concludes
the device is unconfigured, and a wizard generates a real config from the
device's capabilities. Replaying that against real hardware would mean a
factory reset each time; here it is one RPC.

## What it serves

Device readings come from `fixtures.json`, so the Status and uCoord pages show
plausible data: three peers in venue `home`, fourteen clients, radio
capabilities and traffic history.

The client list is synthetic. MAC addresses are from the documentation range
reserved by RFC 7042, and hostnames, SSIDs and addresses are generic, so the
fixture carries nothing from the network it was captured on.

The configuration is live. `config-apply` writes `state/config.json` and
`config-get` returns it thereafter, so an edit made in the UI survives a
reload. `state/` is gitignored; `factory-reset` deletes it and the next
`config-get` serves `factory.json` again.

`factory.json` is deliberately minimal: `wan` upstream on `wan*`, `lan`
downstream on `lan*` offering ssh and webui, and an `ssh` service block. There
is **no top-level `webui` key**: its absence is the signal that the device has
not been through setup. The `webui` in `lan.services` is the daemon that serves
the UI, which is a different thing.

## Fidelity

The wire protocol matches the device, so the app needs no dev-only branch:
endpoint `/uconfig`, subprotocol `uconfig`, a `login-required` notification
200ms after connect, and the same JSON-RPC error codes.

The methods that act on the device are top level and take no address, since a
device managing itself has nothing to address: `config-get`, `config-apply`,
`capabilities`, `system-info`, `reboot` and the rest. The venue-scoped ucoord
calls remain for coordinating other devices and still take `{venue, peer}`;
they are prefixed `peer-` here to keep the two families apart.

Two deliberate differences:

- **`factory-reset` exists here** and does not on a real ucoord server, where
  it belongs to `uconfig-ui`. The mock needs a way back to first boot.
- **`state` fails** with `ubus error: 3`, matching a real device, where the
  method is registered but the underlying ubus object is not.

The mock does not drop idle connections. A real AP closes a quiet socket after
roughly a minute, which is why the client sends `ping`; the mock answers it but
never hangs up.

## Installed modules

`login` returns `modules`, the optional packages the device has installed. The
list here is what `/etc/uconfig/modules/` holds on the GL-MT6000:

```
adguardhome  batman-adv  lldp  mdns  qosify  tailscale  ucoord
```

Those are package names, not config keys, and the two do not always match:
`qosify` is the package behind the `quality-of-service` config block. A service
with no package name, such as ssh or ntp, ships with the base system and is
always available.

`--no-modules` omits the field, which is how a device that reports nothing
behaves; the UI then offers everything. A `modules` RPC returns the same list
for a session that wants to re-read it.

## Adding an RPC

1. Add an `m_<name>` coroutine to `Session` in `server.py`.
2. Register it in `handlers()` with whether it needs authentication.
3. If it addresses a peer, add its name to `ADDRESSED` so the venue and peer
   arguments are enforced the way the device enforces them.
4. Once the shape has settled, port it to `handle_<name>` in the ucode handler
   and add it to the `handlers` table there.
