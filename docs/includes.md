# One include for the whole venue

Decisions taken 2026-08-08 about what an include is for, and why there is
exactly one of them.

Sources:
- src/lib/includes.ts — the name, the reference format, the resolver
- src/lib/interfaces.ts — reading a VLAN id that may arrive through a fragment
- src/lib/changes.ts — `include_mounts()`, `fragment_diff()`, per-overlay scopes
- src/lib/store.svelte.ts — `payload_export()`, `scope_reset()`
- ../uconfig/files/usr/share/ucode/uconfig/includes.uc — the device's resolver
- ../uconfig/modules/ucoord/usr/sbin/ucoord — `include_sync`, `include_apply`

## What an overlay is

Most of a config describes this device: its ports, its addresses, its hostname.
A little of it describes the *venue*, and has to read the same on every device
in it. A guest VLAN is the clearest case: an access point tags guest traffic
100 and the router answers DHCP on 100, and if the two ever disagree the guest
network silently stops working.

That kind of setting is an **overlay**. It lives in an include fragment rather
than in the document, so one value serves every device.

## Why one file, not one per thing

ucoord syncs whole files across a venue (`include_sync` requests by name,
`include_apply` writes what an announce carries). A file per overlay would be
several things to keep in step, several chances for a device to hold half the
set, and no benefit: nothing distributes them separately.

So there is one fragment, `my-network`, and each top-level key in it is one
overlay. Today that is `guest-vlan`; the shape allows more without another
file.

```json
{ "uuid": 1786194000, "guest-vlan": { "id": 100 } }
```

The document declares where it comes from and points at the piece it wants:

```json
{
  "includes": { "my-network": "ucoord:my-network" },
  "interfaces": {
    "guest": { "vlan": { "include": ["my-network.guest-vlan"] } }
  }
}
```

`ucoord:` resolves to `/etc/ucoord/configs/my-network.json`, the directory
ucoord already syncs. `local:` would be `/etc/uconfig/my-network.json`, this
device only, which is the one thing an overlay must not be.

**The alias and the file name are deliberately the same string.** The device
splits a reference on its first dot and looks the leading part up in the
`includes` map; `include_mounts()` reads that same leading part as a key into
`store.includes`, which is keyed by file name. Equal names keep both readings
true.

## The document points, the fragment holds

`interfaces.guest.vlan` carries no `id`. The id is in the fragment, and the
device merges it in before validating. That is the whole point: a peer that
receives the same fragment gets the same id without anyone editing its
document.

The consequence is that reading `iface.vlan.id` off the document no longer
tells you the VLAN. `vlan_id()` in `src/lib/interfaces.ts` reads through the
reference, and the port and VLAN logic goes through it. `include_resolve()`
mirrors the device's `deep_merge`, fragment winning on a collision, so the UI
and the device agree on what a merged object contains.

`includes` and `include` are **not in the schema**. uconfig resolves and then
strips both before validating, so they are written through a cast and never
appear in the generated types.

## Changes are scoped per overlay

A change to a fragment is scoped `include:<name>/<key>`, not `include:<name>`.
Resetting a guest VLAN would otherwise take every other venue setting with it.
The Changes page groups an overlay under the page that sets it rather than
under the file it travels in.

## What is not built

`config-apply` writes this device's copy of the fragment. Nothing yet pushes it
to the venue: that is ucoord's `include` RPC with `action: set`, which stamps a
uuid and announces the new set to peers. Until that is wired up, a fragment
edited here reaches other devices only when they sync from a peer that already
has it.

Distribution also stops short of the reference. ucoord copies *files*; it does
not make a peer's document contain `include: [...]`. Each device still declares
for itself which overlays it uses.
