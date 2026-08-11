// State and config generation for the first-run setup wizard.
//
// A device that has never been set up has no top-level `webui` object in its
// config. The wizard collects what cannot be derived from the hardware and
// writes a whole document from it; applying that document is what marks the
// device as configured.

import { tz_resolve } from './store.svelte.ts'
import { GUEST_VLAN, GUEST_SUBNET, radio_bands } from './guest.ts'
import { GUEST_VLAN_KEY, INCLUDE_NAME, include_declare, ref_attach } from './includes.ts'
import type { IncludeFragment } from './store.svelte'
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
// renumber anything that refers to them.
export const WIZARD_STEPS = ['mode', 'password', 'identity', 'wifi', 'guest', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

// Both modes offer a guest network: the router owns the subnet, and an access
// point bridges onto the same VLAN.
export function wizard_steps(_mode: WizardMode): WizardStep[] {
  return [...WIZARD_STEPS]
}

// The device password has no length rule of its own. The Wi-Fi limits come
// from the schema: an SSID is 1 to 32 characters, and a WPA passphrase is 8 to
// 63.
const MIN_PASSWORD = 1
export const MAX_SSID = 32
export const MIN_KEY = 8
export const MAX_KEY = 63

// The message for whatever is wrong with a step, or null when it may be left.
export function step_error(step: WizardStep, d: WizardData): string | null {
  if (step === 'password') {
    if (d.password.length < MIN_PASSWORD) return 'A password is required'
    if (d.password !== d.passwordRepeat) return 'The two entries do not match'
    return null
  }
  if (step === 'identity') {
    if (!d.hostname.trim()) return 'A hostname is required'
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(d.hostname)) return 'Letters, digits and hyphens only'
    return null
  }
  if (step === 'wifi') return wifi_error(d.ssid, d.key)
  if (step === 'guest') return d.guestOn ? wifi_error(d.guestSsid, d.guestKey) : null
  return null
}

function wifi_error(ssid: string, key: string): string | null {
  if (!ssid.trim()) return 'A network name is required'
  if (ssid.length > MAX_SSID) return `A network name is at most ${MAX_SSID} characters`
  if (key.length < MIN_KEY) return `The password needs at least ${MIN_KEY} characters`
  if (key.length > MAX_KEY) return `The password is at most ${MAX_KEY} characters`
  return null
}

function ssid_block(name: string, key: string, security: WizardSecurity, radios: string[]) {
  return {
    ssid: name,
    'wifi-radios': radios,
    template: { mode: 'encrypted', security, key }
  }
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


// The fragments that go up alongside a wizard document. Empty when there is no
// guest network, because the VLAN is the only thing the include carries and the
// device rejects a fragment the document does not declare a source for.
export function wizard_includes(d: WizardData): Record<string, IncludeFragment> {
  if (!d.guestOn) return {}
  return { [INCLUDE_NAME]: { [GUEST_VLAN_KEY]: { id: GUEST_VLAN } } }
}

function guest_vlan_ref(): Record<string, unknown> {
  const ref: Record<string, unknown> = {}
  ref_attach(ref, GUEST_VLAN_KEY)
  return ref
}

export function wizard_document(d: WizardData, capabilities: unknown): UconfigDocument {
  const bands = radio_bands(capabilities)
  const main = ssid_block(d.ssid, d.key, d.security, bands)
  const guest = () => ssid_block(d.guestSsid, d.guestKey, d.guestSecurity, bands)

  const doc: Record<string, unknown> = {
    // uconfig rejects a document with no integer uuid in strict mode, and the
    // client has to be the one to supply it. `uconfig-apply` does stamp one --
    // but that block is guarded by `if (!opts.no_apply)`, and `-t` sets
    // no_apply, so the test run that gates every apply never reaches it. The
    // device re-stamps this on apply; the value only has to be there.
    uuid: Math.floor(Date.now() / 1000),
    // No password here: `unit.password` is the /etc/shadow hash, which only the
    // device can produce. The chosen password goes over `change-password`.
    unit: { hostname: d.hostname.trim(), timezone: d.timezone },
    radios: radios_for(bands),
    services: { ssh: { port: 22 } },
    // Marks the device as set up, so the wizard does not run again, and records
    // which profile produced the rest of the document.
    webui: { version: 1, profile: d.mode }
  }

  if (d.mode === 'ap') {
    // Every port on one upstream; addressing comes from the router that already
    // runs the network.
    const interfaces: Record<string, unknown> = {
      wan: {
        role: 'upstream',
        services: ['ssh', 'uconfig-ui'],
        ports: { 'wan*': 'auto', 'lan*': 'auto' },
        ipv4: { addressing: 'dynamic' },
        ipv6: { addressing: 'dynamic' },
        ssids: { main }
      }
    }

    // No address of its own: the access point only bridges guest traffic onto
    // the VLAN, and the router answers DHCP on it.
    if (d.guestOn) {
      interfaces.guest = {
        role: 'upstream',
        ports: { 'wan*': 'auto', 'lan*': 'auto' },
        vlan: guest_vlan_ref(),
        ipv4: { addressing: 'none' },
        ssids: { guest: guest() }
      }
    }

    doc.interfaces = interfaces
    if (d.guestOn) include_declare(doc)
    return doc as UconfigDocument
  }

  const interfaces: Record<string, unknown> = {
    wan: {
      role: 'upstream',
      ports: { 'wan*': 'auto' },
      ipv4: { addressing: 'dynamic' },
      ipv6: { addressing: 'dynamic' }
    },
    lan: {
      role: 'downstream',
      services: ['ssh', 'uconfig-ui'],
      ports: { 'lan*': 'auto' },
      ipv4: {
        addressing: 'static',
        subnet: '192.168.1.1/24',
        'dhcp-pool': { 'lease-first': 10, 'lease-count': 100, 'lease-time': '6h' }
      },
      ipv6: { addressing: 'static', dhcpv6: { mode: 'hybrid' } },
      ssids: { main }
    }
  }

  // The router owns the guest subnet and serves DHCP on the VLAN, which is what
  // lets an access point bridge onto it. Barred from the networks upstream of
  // it, so guests reach the internet and nothing else.
  if (d.guestOn) {
    interfaces.guest = {
      role: 'downstream',
      ports: { 'lan*': 'auto' },
      vlan: guest_vlan_ref(),
      ipv4: {
        addressing: 'static',
        subnet: GUEST_SUBNET,
        'dhcp-pool': { 'lease-first': 10, 'lease-count': 100, 'lease-time': '6h' },
        'disallow-upstream-subnet': true
      },
      ssids: { guest: guest() }
    }
  }

  doc.interfaces = interfaces
  if (d.guestOn) include_declare(doc)
  return doc as UconfigDocument
}
