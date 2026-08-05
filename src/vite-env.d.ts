/// <reference types="svelte" />
/// <reference types="vite/client" />

// Replaced literally at build time by vite.config.js `define`, so the flavour
// branches fold away and Rollup can drop the unreachable subtree.
declare const __FLAVOUR__: string
declare const __IS_DEVICE__: boolean
declare const __IS_EDITOR__: boolean
