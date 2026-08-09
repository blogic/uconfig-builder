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

Since split into two sections: Wireless holds Main, Guest and Radios; Network
holds WAN, LAN and a second Guest page for the guest network's addresses and
its VLAN. The wireless side of a guest network and the wired side of it turned
out to be different questions asked by different people.

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

### A page that is absent rather than apologetic

Network › Guest applies only to a router with the guest network switched on: an
access point carries guest traffic but owns none of its settings, and a network
that is off has nothing to address. Both cases used to render a paragraph
explaining why the page was empty. The page and its sidebar entry are now
absent instead — a menu entry that leads to an excuse is worse than no entry.

`NavItem.when` carries the predicate, shaped after `LayoutNode.when`.
`items_for()` in `src/lib/nav.ts` is the single place it is evaluated, because
the sidebar and the effect that keeps the open page valid must agree: a page
the sidebar hides but the effect still counts is one the user cannot leave.

### Switched off, not deleted

Turning the guest network off sets `interfaces.guest.disable` rather than
removing the interface. uconfig deletes a disabled interface whole before it
renders anything, so nothing reaches the wire; keeping the object means the
SSID, key and subnet are still there when the network comes back.

Two consequences. Anything derived from the document has to skip a disabled
interface, or a switched-off network goes on blocking the ports and VLAN ids it
no longer uses (`iface_enabled()` in `src/lib/interfaces.ts`). And the PSK of a
disabled network is stripped on the way to the device: it would sit in the
config doing nothing but waiting to leak. The document keeps it, so re-enabling
before an apply loses nothing; applying while disabled means it has to be
typed again.

### Live status readouts

The mockups showed a lease card on WAN and a channel-in-use panel on Radios,
and for a long time neither was built: nothing in the RPC surface returned a
per-interface address or a radio's operating state. `status` is ucoord
topology, `system-info` is host resources, and `devices` is client-side.

`radios`, `ports` and `network` answer it now, and they belong to Status rather
than to a configuration page: a configuration page says what was asked for, and
whether it happened is a different question. See
[device-state.md](device-state.md) and
[the mockups](mockups/status-pages.html).

Status is **Internet**, **Network**, **Wireless**, **Clients**. Traffic is gone
as a page of its own and now opens Internet, because a throughput graph
explains nothing without the address and lease beside it.

Two things the pages have to get right, both learned from drawing them:

The uplink is found by `uplink()` in `src/lib/netstate.svelte.ts`, and a
gateway alone is not enough to go on. An uplink that has lost its lease has no
gateway, which is precisely the state the page exists to explain, so it falls
back to an addressing protocol that goes upstream (`dhcp`, `pppoe` and the
rest) and finally to the name `wan`. Get this wrong and the dead uplink leaks
onto Network as a nameless local interface.

"Not working" is several different states and they are not interchangeable.
No carrier, carrier but no address, and no upstream interface at all send
someone to three different places; collapsing them into one message sends them
to swap a cable that was never the problem.

Two joins are still by case-folding rather than agreement. `radios` keys on
`2g`/`5g` where the schema says `2G`/`5G`, and `ports` names sockets `WAN` and
`LAN1` where `capabilities` calls them `eth1` and `lan1`. Both are folded
client-side; the device emitting the schema's spelling would be better.

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

## System: the services the device offers

Three services have a page of their own under **System › Services**, a group that
expands in the sidebar the way Configure's does: SSH, LLDP and Logging. Above
them sit **Overview**, which reports rather than asks and so comes first, and
**Time**, holding the timezone and `definitions.ntp-servers`.

The live app never had these at all. Configure carries no `device` flag, so
`sections_for()` drops it when `IS_EDITOR` is false, and the service pages went
with it: a device build had nowhere to configure a service. Nothing moved out of
Configure, which stays the raw editor for the offline build.

Mockups: [docs/mockups/applications-services.html](mockups/applications-services.html).

### One switch, two places written

The switch is the substance of these pages. uconfig starts most services from
the interfaces naming them, not from the settings block: each template calls
`lookup_interfaces()` and returns early when nothing lists it. So switching SSH
on writes `services.ssh` **and** `ssh` into an interface's `services` array,
and the networks it is offered on are a first-class control rather than
something buried.

That is also why the old toggle was half a switch. `service_enable()` and
`service_disable()` only add and remove the block, and the comment on the latter
says interface lists are deliberately left alone. For SSH, mDNS and LLDP that
means the editor's toggle starts nothing and stops nothing.

**Off clears the networks and keeps the settings**, so the port, keys and
announced names survive for whenever the service comes back.

Logging has no switch at all. The device keeps a local log buffer whatever the
config says, so an off would be a lie; the block only tunes it, and sending a
copy to a syslog server is the part that is optional, behind a **Remote
Logging** disclosure. The page materialises the block to have somewhere to
write, which is why the diff skips the presence check for it: a block holding
nothing but schema defaults says what no block says, and opening a page should
not leave an edit behind.

### Which services, and why not the rest

Only the four with an honest switch. A RADIUS server starts whenever its package
is installed — `services.set_enabled("radius", true)` is unconditional — so a
switch would be a lie. 802.1X is started by an interface's `ieee8021x-ports`
rather than by being offered on a network. AdGuard Home, Tailscale and Quality
of Service are applications rather than plumbing and are waiting for a menu of
their own.

### A service's networks are the service's changes

Which networks offer a service is diffed per service rather than as one field of
the interface, and scoped `service:<name>` to match the block. Without that the
edit belonged to the interface: the page's own changes badge stayed empty while
the entry appeared under **Network › LAN**, so a network toggle looked like it
had not been recorded at all.

One entry per service that moved, reading "Offered 'SSH' on wan". Resetting the
service restores its networks as well as its settings, since one page wrote
both, and `canon_iface` drops `services` so it is not reported twice. Resetting
an interface leaves the list alone, the way it already leaves the SSIDs alone.

Each service groups under its own name, "System › Services › Logging": with a
page per service, the section alone could not say which of them a bare "Changed
Host" belonged to. The field names stay the schema's, as they are everywhere
else in the changes list.

### The page does not collapse when the last network goes

Turning the last network off is how a service is switched off, so the page
cannot hide its own controls at that moment: there would be nowhere to turn one
back on. The networks and settings show whenever the service has a block at
all, and the switch above them reports whether anything is offering it.

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

1. **Configure's fate.** Partly answered: four services and `ntp-servers` now
   have homes under System, and Configure keeps them too as the raw editor for
   the offline build. Still without one: `unit`, which the changes list already
   labels "System › Device", and the three applications. To be decided.
2. **AP mode.** There is no lan interface and wan carries every port, so LAN
   and much of WAN do not apply. Either hide the pages, or show them explaining
   that the upstream router owns those settings.
3. **Wireless and Guest overlap.** Guest is also a Wi-Fi network. Either
   Wireless owns the main network only and Guest owns its own (as drawn), or
   Wireless lists every SSID and Guest keeps only the switch, VLAN and subnet.
