// State and config generation for the first-run setup wizard.
//
// A device that has never been set up has no top-level `webui` object in its
// config. The wizard collects what cannot be derived from the hardware and
// writes a whole document from it; applying that document is what marks the
// device as configured.

import { tz_resolve } from './store.svelte.ts'
import type { UconfigDocument } from './types/uconfig'

export type WizardMode = 'router' | 'ap'
export type WizardSecurity = 'maximum' | 'compatibility'

export interface WizardData {
  mode: WizardMode
  password: string
  passwordRepeat: string
  hostname: string
  timezone: string
  ssid: string
  key: string
  security: WizardSecurity
  guestOn: boolean
  guestSsid: string
  guestKey: string
  guestSecurity: WizardSecurity
}

export function wizard_defaults(): WizardData {
  return {
    mode: 'router',
    password: '',
    passwordRepeat: '',
    hostname: 'openwrt',
    timezone: tz_resolve(),
    ssid: '',
    key: '',
    security: 'maximum',
    guestOn: false,
    guestSsid: '',
    guestKey: '',
    guestSecurity: 'maximum'
  }
}

// Steps are addressed by name rather than index so inserting one does not
// renumber the guards below.
export const WIZARD_STEPS = ['mode', 'password', 'identity', 'wifi', 'guest', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

// Guest needs a second subnet to isolate, which an access point does not own.
export function wizard_steps(mode: WizardMode): WizardStep[] {
  return WIZARD_STEPS.filter((s) => s !== 'guest' || mode === 'router')
}

const MIN_PASSWORD = 8
const MIN_KEY = 8

// The message for whatever is wrong with a step, or null when it may be left.
export function step_error(step: WizardStep, d: WizardData): string | null {
  if (step === 'password') {
    if (d.password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`
    if (d.password !== d.passwordRepeat) return 'The two entries do not match'
    return null
  }
  if (step === 'identity') {
    if (!d.hostname.trim()) return 'A hostname is required'
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(d.hostname)) return 'Letters, digits and hyphens only'
    return null
  }
  if (step === 'wifi') {
    if (!d.ssid.trim()) return 'A network name is required'
    if (d.key.length < MIN_KEY) return `The password needs at least ${MIN_KEY} characters`
    return null
  }
  if (step === 'guest') {
    if (!d.guestOn) return null
    if (!d.guestSsid.trim()) return 'A network name is required'
    if (d.guestKey.length < MIN_KEY) return `The password needs at least ${MIN_KEY} characters`
    return null
  }
  return null
}

function ssid_block(name: string, key: string, security: WizardSecurity, radios: string[]) {
  return {
    ssid: name,
    'wifi-radios': radios,
    template: { mode: 'encrypted', security, key }
  }
}

// Bands the device actually has, so the wizard never asks about radios.
function radio_bands(capabilities: unknown): string[] {
  const wiphy = (capabilities as { wiphy?: { bands?: Record<string, unknown> }[] } | null)?.wiphy
  if (!Array.isArray(wiphy)) return ['2G', '5G']
  const bands = new Set<string>()
  for (const phy of wiphy) {
    for (const band of Object.keys(phy?.bands ?? {})) bands.add(band)
  }
  return bands.size ? [...bands] : ['2G', '5G']
}

// One radio entry per band the hardware reports, so the document matches the
// device rather than a guess.
function radios_for(bands: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const band of bands) {
    out[band] = band === '2G' ? { 'channel-mode': 'HE', 'channel-width': 20 } : { 'channel-mode': 'HE', 'channel-width': 80 }
  }
  return out
}

export function wizard_document(d: WizardData, capabilities: unknown): UconfigDocument {
  const bands = radio_bands(capabilities)
  const main = ssid_block(d.ssid, d.key, d.security, bands)

  const doc: Record<string, unknown> = {
    unit: { hostname: d.hostname.trim(), timezone: d.timezone, password: d.password },
    radios: radios_for(bands),
    services: { ssh: { port: 22 } },
    // Marks the device as set up, so the wizard does not run again, and records
    // which profile produced the rest of the document.
    webui: { version: 1, profile: d.mode }
  }

  if (d.mode === 'ap') {
    // One upstream carrying every port; addressing comes from the router that
    // already runs the network.
    doc.interfaces = {
      wan: {
        role: 'upstream',
        services: ['ssh', 'webui'],
        ports: { 'wan*': 'auto', 'lan*': 'auto' },
        ipv4: { addressing: 'dynamic' },
        ipv6: { addressing: 'dynamic' },
        ssids: { main }
      }
    }
    return doc as UconfigDocument
  }

  const lan: Record<string, unknown> = {
    role: 'downstream',
    services: ['ssh', 'webui'],
    ports: { 'lan*': 'auto' },
    ipv4: {
      addressing: 'static',
      subnet: '192.168.1.1/24',
      'dhcp-pool': { 'lease-first': 10, 'lease-count': 100, 'lease-time': '6h' }
    },
    ipv6: { addressing: 'static', dhcpv6: { mode: 'hybrid' } },
    ssids: { main }
  }

  doc.interfaces = {
    wan: {
      role: 'upstream',
      ports: { 'wan*': 'auto' },
      ipv4: { addressing: 'dynamic' },
      ipv6: { addressing: 'dynamic' }
    },
    lan
  }

  if (d.guestOn) {
    // Its own subnet, and barred from reaching the networks upstream of it.
    ;(doc.interfaces as Record<string, unknown>).guest = {
      role: 'downstream',
      ports: {},
      ipv4: {
        addressing: 'static',
        subnet: '192.168.2.1/24',
        'dhcp-pool': { 'lease-first': 10, 'lease-count': 100, 'lease-time': '6h' },
        'disallow-upstream-subnet': true
      },
      ssids: { guest: ssid_block(d.guestSsid, d.guestKey, d.guestSecurity, bands) }
    }
  }

  return doc as UconfigDocument
}
