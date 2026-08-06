import type { UconfigDocument } from './types/uconfig'

// Central persisted settings. Reactive $state mirrored to localStorage; add new
// keys here as more user preferences are introduced.
const KEY = 'uconfig-builder'

export interface Settings {
  host?: string
  configs?: Record<string, UconfigDocument>
}

function load(): Settings {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}')
    // The theme followed a manual switch that no longer exists; drop any value
    // left by an older build so it cannot pin the UI against the system.
    delete saved.theme
    return saved
  } catch {
    return {}
  }
}

export const settings: Settings = $state(load())

$effect.root(() => {
  $effect(() => {
    const data = JSON.stringify(settings)
    if (data === '{}') return // nothing chosen yet; keep localStorage untouched
    try {
      globalThis.localStorage?.setItem(KEY, data)
    } catch {
      /* storage unavailable */
    }
  })
})
