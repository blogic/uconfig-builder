// Device pages, loaded only in builds that talk to an AP. Reached through a
// dynamic import behind IS_DEVICE so the editor flavour drops them, along with
// the stores and websocket client they alone depend on.

export { default as NetworkPage } from './components/NetworkPage.svelte'
export { default as TrafficPage } from './components/TrafficPage.svelte'
export { default as StatePage } from './components/StatePage.svelte'
export { default as SystemPage } from './components/SystemPage.svelte'
