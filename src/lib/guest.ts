// What a guest network is made of, shared by the setup wizard and the Guest
// page so that a network created by one is the same network as the other's.
//
// These live here rather than in wizard.svelte.ts because GuestSection and
// GuestVlanField read them, and both are reachable from the shared schema
// renderer. A widget importing the wizard would put the whole device-side
// module behind every form that renders a VLAN field.

// Guest traffic is carried on its own VLAN, so an access point can bridge it to
// the router that owns the subnet rather than routing it itself. The id has to
// be the same on every device in the venue, so the document points at the
// shared include and this is only the value that seeds it.
export const GUEST_VLAN = 100
export const GUEST_SUBNET = '192.168.100.1/24'

// Bands the device actually has, so nothing asks about radios it lacks. The
// fallback is the common pair, which is what an offline editor should assume
// when there is no device to report anything.
export function radio_bands(capabilities: unknown): string[] {
  const wiphy = (capabilities as { wiphy?: { bands?: Record<string, unknown> }[] } | null)?.wiphy
  if (!Array.isArray(wiphy)) return ['2G', '5G']
  const bands = new Set<string>()
  for (const phy of wiphy) {
    for (const band of Object.keys(phy?.bands ?? {})) bands.add(band)
  }
  return bands.size ? [...bands] : ['2G', '5G']
}
