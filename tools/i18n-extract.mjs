// Sync src/lib/locales/en-GB.json with every translatable string in the app:
// schema descriptions, schema enum values, humanised property titles, and any
// t('...') call in source. Existing translations are preserved; new keys are
// seeded with the English source; obsolete keys are dropped.
//
//   node tools/i18n-extract.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import ts from 'typescript'

const { transpileModule, ScriptTarget, ModuleKind } = ts
// labels.ts and descriptions.ts hold data this script needs, but node cannot
// import TypeScript. Both are plain declarations, so stripping the annotations
// and evaluating the result keeps the single source of truth rather than
// duplicating the tables here.
async function ts_module_load(relPath) {
  const src = readFileSync(new URL(relPath, import.meta.url), 'utf8')
  const js = transpileModule(src, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(root, 'src/lib/data/schema.json')
const localePath = join(root, 'src/lib/locales/en-GB.json')
const srcDir = join(root, 'src')

const keys = new Set()

const labels = await ts_module_load('../src/lib/labels.ts')
const descriptions = await ts_module_load('../src/lib/descriptions.ts')
const title_for = labels.title_for

// Description text lives as object values rather than in t() calls, so it has
// to be pulled from the modules directly: field help, page intros and the
// per-service blurbs alike.
for (const bag of [descriptions.DESCRIPTIONS, descriptions.PAGE_DESCRIPTIONS, descriptions.SERVICE_DESCRIPTIONS])
  for (const v of Object.values(bag)) if (v) keys.add(v)

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
function walk_schema(node) {
  if (Array.isArray(node)) {
    node.forEach(walk_schema)
    return
  }
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node.enum)) for (const v of node.enum) if (typeof v === 'string') keys.add(v)
  for (const bag of ['properties', 'patternProperties']) {
    if (node[bag] && typeof node[bag] === 'object') {
      for (const k of Object.keys(node[bag])) if (!k.includes('.+') && !k.startsWith('^')) keys.add(title_for(k))
    }
  }
  for (const v of Object.values(node)) walk_schema(v)
}
walk_schema(schema)

// t('...') calls, plus inlined label:/describe: metadata in layouts.
const PATTERNS = [/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g, /\b(?:label|describe)\s*:\s*(['"])((?:\\.|(?!\1).)*)\1/g]
function unescape(s) {
  return s.replace(/\\(['"\\nt])/g, (_, c) => ({ "'": "'", '"': '"', '\\': '\\', n: '\n', t: '\t' }[c]))
}
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name !== 'locales' && name !== 'data') scan(p)
      continue
    }
    if (!/\.(svelte|js|ts)$/.test(name)) continue
    if (name.endsWith('.d.ts')) continue
    const code = readFileSync(p, 'utf8')
    for (const re of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(code))) keys.add(unescape(m[2]))
    }
  }
}
scan(srcDir)

let existing = {}
try {
  existing = JSON.parse(readFileSync(localePath, 'utf8'))
} catch {
  /* first run */
}

const sorted = [...keys].filter(Boolean).sort((a, b) => a.localeCompare(b))
const out = {}
let added = 0
for (const k of sorted) {
  out[k] = Object.prototype.hasOwnProperty.call(existing, k) ? existing[k] : k
  if (!(k in existing)) added++
}
const obsolete = Object.keys(existing).filter((k) => !(k in out))

writeFileSync(localePath, JSON.stringify(out, null, 2) + '\n')
console.log(
  `i18n sync: ${sorted.length} keys (${added} new, ${obsolete.length} obsolete` +
    (obsolete.length ? `: ${obsolete.join(', ')}` : '') +
    ').'
)
