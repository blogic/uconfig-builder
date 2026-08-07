# The live app's navigation

Decisions taken 2026-08-07 about how the live app is organised: a Network
section of intent-shaped pages, and a consolidated Changes menu.

This is the concrete shape of the direction set out in
[product-direction.md](product-direction.md): the live app speaks the
vocabulary of what a network does, not of the document's structure. That
document says why; this one says what the menus are.

Sources:
- src/lib/nav.ts — `SECTIONS`, `sections_for()`, the `whenChanges` rule
- src/App.svelte — `bodyFor()`, `availableSections`, `changes`
- src/lib/changes.ts — `ChangeEntry`, `changes_for()`
- src/lib/store.svelte.ts — `scope_reset()`
- src/lib/data/schema.json — the fields each page maps onto
- Mockups: docs/mockups/network-section.html

## Network: five intent pages

A top-level **Network** section with five sidebar pages.

| Page | Owns | Reads/writes |
|---|---|---|
| Wireless | the main Wi-Fi network | `ssids.main` on the lan interface (wan in AP mode) |
| Guest | the guest network as one decision | `interfaces.guest` entire: VLAN, subnet, SSID |
| Radios | the hardware behind the networks | `radios.<band>` |
| WAN | the uplink | `interfaces.wan` |
| LAN | the local network and its DHCP pool | `interfaces.lan` |

Each page asks what the user wants and derives the schema fields itself. Two
examples of what that means in practice, both from the mockups:

- **LAN** shows a first and last address; the schema stores
  `dhcp-pool.lease-first: 10` and `lease-count: 100`. The page computes both
  ways against `ipv4.subnet`. Nobody thinks about their network as an offset
  and a count.
- **Radios** offers transmit power as four named steps rather than dBm.
  `Maximum` writes 30, which is the schema default, so choosing it clears the
  field rather than setting it.

**Guest is an interface, not an SSID.** It carries its own VLAN (100), its own
subnet, and `disallow-upstream-subnet`. Presenting it as one switch with
consequences is the clearest case of the vocabulary shift: the user decides
"visitors get their own network", and the page writes four objects.

### No live status readouts

The mockups show a lease card on WAN and a channel-in-use panel on Radios.
Neither was built: nothing in the RPC surface returns a per-interface address
or a radio's operating state. `status` is ucoord topology, `system-info` is
host resources, and `devices` is client-side. Both need a device-side method
that does not exist yet.

### Advanced disclosures

Fields with no plain-language equivalent (`channel-mode`, `allow-dfs`,
`legacy-rates`, `maximum-clients`, and the rest) sit behind a collapsed
**Advanced** section on the page that owns them. This keeps the default view
plain without putting anything out of reach.

This matters more as the raw editor recedes from the live app. Anything an
intent page omits with no disclosure becomes unreachable on a device, so
omission has to be a decision rather than an oversight.

### Not yet placed

No intent phrasing yet, and no page: `multi-psk`, `access-control-list`,
`rate-limit`, `roaming`, `bss-mode`, `bssid`, `vendor-elements`,
`ieee8021x-ports`, `quality-of-service`, `broad-band`, `dhcp-leases`, and port
and VLAN-trunk assignment. Ports show read-only on WAN; assignment stays in
Configure for now.

Two of these look like pages in their own right rather than Advanced fodder:

- `dhcp-leases` is "always give this device the same address", which belongs
  beside the client list rather than in a form.
- `multi-psk` and `access-control-list` are both per-device Wi-Fi policy and
  might share one page.

## Changes: one menu, conditionally rendered

Edits now originate in several sections, so a pending-changes item inside one
sidebar no longer describes the state of the document. **Changes** becomes a
top-level menu entry.

**It is rendered only when something is pending**, and absent otherwise. No
badge: the presence of the entry is the signal. This is the existing
`whenChanges` rule that governs the current sidebar item, lifted to the top
level.

The page groups by **where the edit was made** rather than by document domain,
so the labels match the menu the user clicked:

```
Network › Wireless     2 changes    [Reset]
Network › Guest        1 change     [Reset]
System  › Device       1 change     [Reset]
                       [Apply to device]  [Reset all]
```

This needs no new tracking. `ChangeEntry` already carries `scope` (the owning
page) and `doc` (main config, or a named include) from the includes work, so
grouping by origin is a regrouping of data that already exists. What changes is
that grouping moves off `ChangeEntry.section` — currently `Unit`, `Radios`,
`Interfaces` — onto the owning page. Per-group Reset reuses `scope_reset(scope)`
unchanged.

### The disappearing section needed no special handling

The section vanishes when the last change is applied or reset, so the page the
user is on goes with it. That turned out to need no new code: `activeSection`
already falls back to the first available section when `section` names one that
is gone, the validity effect corrects `view.section` to match, and `route_sync`
follows `activeSection` rather than the stale value. The app lands on Status.

## Open questions

1. **Configure's fate.** The live app is moving to intent pages throughout, so
   the Configure section's schema-driven forms are not the long-term shape.
   Whatever it covered still needs a home: `unit`, the nine `services`, and
   `definitions.ntp-servers` are not network settings and have no page in the
   Network set. To be decided.
2. **AP mode.** There is no lan interface and wan carries every port, so LAN
   and much of WAN do not apply. Either hide the pages, or show them explaining
   that the upstream router owns those settings.
3. **Wireless and Guest overlap.** Guest is also a Wi-Fi network. Either
   Wireless owns the main network only and Guest owns its own (as drawn), or
   Wireless lists every SSID and Guest keeps only the switch, VLAN and subnet.
