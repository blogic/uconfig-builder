import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Build flavour, injected as a compile-time constant so the unused half of the
// app is tree-shaken away rather than merely hidden:
//   editor - standalone JSON editing, no device connection
//   device - connect to an AP, no bundled examples
//   full   - both (the default)
const flavour = process.env.UCONFIG_FLAVOUR ?? 'full'

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
