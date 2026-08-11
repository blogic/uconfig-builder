// The bundled example documents.
//
// Kept out of store.svelte.ts, which both halves of the app import, because the
// JSON import is unconditional: while it lived there the device build shipped
// 22 KB of configs it has no way to load. Only the editor offers these, so only
// the editor should carry them.

import type { UconfigDocument } from './types/uconfig'
import examplesJson from './data/examples.json'
import { doc_load } from './store.svelte.ts'

// Full uconfig documents keyed by name. The JSON import is inferred from the
// literal file contents rather than the generated schema types.
export const examples = examplesJson as unknown as Record<string, UconfigDocument>

export const example_names = Object.keys(examples).sort()

export function example_load(name: string) {
  const src = examples[name]
  if (src) doc_load(src, name)
}
