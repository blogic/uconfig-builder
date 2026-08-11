import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Build flavour, injected as a compile-time constant:
//   editor - standalone JSON editing, no device connection
//   device - connect to an AP; no Configure section, no bundled examples
//   full   - both
//
// Defaults to `device`, because that is what this repo is becoming and because
// `full` meant the dev server showed an app neither audience ever gets: the
// live pages and the raw Configure section side by side. Build the editor
// explicitly until the two are separated properly.
//
// Note this only ever removed code at one place, the guarded dynamic import in
// device.svelte.ts. Svelte compiles a template {#if} into a closure that is
// always constructed, so flavour branches in markup hide rather than drop.
const flavour = process.env.UCONFIG_FLAVOUR ?? 'device'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  base: './',
  define: {
    __FLAVOUR__: JSON.stringify(flavour),
    // Literal booleans, so Rollup can drop the branch and everything it
    // imports rather than shipping unreachable code.
    __IS_DEVICE__: String(flavour === 'device' || flavour === 'full'),
    __IS_EDITOR__: String(flavour === 'editor' || flavour === 'full')
  },
  server: { host: true },
  preview: { host: true }
})
