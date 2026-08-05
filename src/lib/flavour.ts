// Which half of the app this build contains.
//
//   editor - standalone JSON editing; no websocket, no device pages
//   device - connect to an AP; no bundled examples
//   full   - both
//
// The flags are replaced with literal `true`/`false` at build time, so a
// `if (IS_DEVICE)` guard around a dynamic import lets Rollup drop the whole
// branch — and everything only it reaches — from the other flavour's bundle.

/* global __FLAVOUR__, __IS_DEVICE__, __IS_EDITOR__ */
export const FLAVOUR = typeof __FLAVOUR__ === 'string' ? __FLAVOUR__ : 'full'
export const IS_DEVICE = typeof __IS_DEVICE__ === 'boolean' ? __IS_DEVICE__ : true
export const IS_EDITOR = typeof __IS_EDITOR__ === 'boolean' ? __IS_EDITOR__ : true
