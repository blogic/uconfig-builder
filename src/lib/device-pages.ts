// Device pages, loaded only in builds that talk to an AP. Reached through a
// dynamic import behind IS_DEVICE so the editor flavour drops them, along with
// the stores and websocket client they alone depend on.

export { default as NetworkPage } from './components/NetworkPage.svelte'
export { default as InternetPage } from './components/InternetPage.svelte'
export { default as WiredPage } from './components/WiredPage.svelte'
export { default as AirtimePage } from './components/AirtimePage.svelte'
export { default as StatePage } from './components/StatePage.svelte'
export { default as UcoordPage } from './components/UcoordPage.svelte'
export { default as SystemBusy } from './components/SystemBusy.svelte'
export { default as RebootPage } from './components/RebootPage.svelte'
export { default as FactoryResetPage } from './components/FactoryResetPage.svelte'
export { default as FirmwarePage } from './components/FirmwarePage.svelte'
export { default as WizardPage } from './components/WizardPage.svelte'
