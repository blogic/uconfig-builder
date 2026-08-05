// Device access behind one lazy façade.
//
// Everything that needs a live AP — the websocket client, the capability and
// polling stores, the device pages — hangs off this module. The app reaches it
// through `device_load()` inside an `if (IS_DEVICE)` guard, so the editor build
// never imports it and Rollup drops the whole subtree.

type ConnMod = typeof import('./connection.svelte.ts')
type CapsMod = typeof import('./capabilities.svelte.ts')
type DevicesMod = typeof import('./devices.svelte.ts')
type SysinfoMod = typeof import('./sysinfo.svelte.ts')
type TrafficMod = typeof import('./traffic.svelte.ts')
type PagesMod = typeof import('./device-pages.ts')
type SystemMod = typeof import('./system.svelte.ts')
type PollMod = typeof import('./poll.svelte.ts')
type UcoordMod = typeof import('./ucoord.svelte.ts')

export interface DeviceMod {
  conn: ConnMod
  caps: CapsMod
  devices: DevicesMod
  sysinfo: SysinfoMod
  traffic: TrafficMod
  pages: PagesMod
  system: SystemMod
  poll: PollMod
  ucoord: UcoordMod
}

let mod: DeviceMod | null = null

export const deviceApi = $state<{ ready: boolean; pages: PagesMod | null }>({ ready: false, pages: null })

export async function device_load(): Promise<DeviceMod> {
  if (mod) return mod
  const [conn, caps, devices, sysinfo, traffic, pages, system, poll, ucoord] = await Promise.all([
    import('./connection.svelte.ts'),
    import('./capabilities.svelte.ts'),
    import('./devices.svelte.ts'),
    import('./sysinfo.svelte.ts'),
    import('./traffic.svelte.ts'),
    import('./device-pages.ts'),
    import('./system.svelte.ts'),
    import('./poll.svelte.ts'),
    import('./ucoord.svelte.ts')
  ])
  mod = { conn, caps, devices, sysinfo, traffic, pages, system, poll, ucoord }
  deviceApi.pages = pages
  deviceApi.ready = true
  return mod
}

// Null until device_load() has run; callers guard on IS_DEVICE first.
export function device_mod(): DeviceMod | null {
  return mod
}
