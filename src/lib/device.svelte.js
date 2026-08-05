// Device access behind one lazy façade.
//
// Everything that needs a live AP — the websocket client, the capability and
// polling stores, the device pages — hangs off this module. The app reaches it
// through `device_load()` inside an `if (IS_DEVICE)` guard, so the editor build
// never imports it and Rollup drops the whole subtree.

let mod = null

export const deviceApi = $state({ ready: false, pages: null })

export async function device_load() {
  if (mod) return mod
  const [conn, caps, devices, sysinfo, traffic, pages, system, poll, ucoord] = await Promise.all([
    import('./connection.svelte.js'),
    import('./capabilities.svelte.js'),
    import('./devices.svelte.js'),
    import('./sysinfo.svelte.js'),
    import('./traffic.svelte.js'),
    import('./device-pages.js'),
    import('./system.svelte.js'),
    import('./poll.svelte.js'),
    import('./ucoord.svelte.js')
  ])
  mod = { conn, caps, devices, sysinfo, traffic, pages, system, poll, ucoord }
  deviceApi.pages = pages
  deviceApi.ready = true
  return mod
}

// Null until device_load() has run; callers guard on IS_DEVICE first.
export function device_mod() {
  return mod
}
