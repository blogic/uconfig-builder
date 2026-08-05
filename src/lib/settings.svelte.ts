import type { UconfigDocument } from './types/uconfig'

// Central persisted settings. Reactive $state mirrored to localStorage; add new
// keys here as more user preferences are introduced.
const KEY = 'uconfig-builder'

export interface Settings {
  theme?: 'light' | 'dark'
  host?: string
  configs?: Record<string, UconfigDocument>
}

function load(): Settings {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}')
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
