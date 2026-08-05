// Regenerate src/lib/types/uconfig.d.ts from the uconfig JSON Schema.
//
//   npm run types:schema
//
// The generator names the root interface after the schema $id, which is not a
// usable identifier in application code, so a UconfigDocument alias is appended.

import { compileFromFile } from 'json-schema-to-typescript'
import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(root, 'src/lib/data/schema.json')
const outPath = join(root, 'src/lib/types/uconfig.d.ts')

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const rootName = schema.title ?? 'HttpsUconfigOpenwrtOrgUconfigSchemaJson'

const body = await compileFromFile(schemaPath, {
  bannerComment: [
    '// Generated from src/lib/data/schema.json by tools/schema-types.mjs.',
    '// Do not edit by hand; run `npm run types:schema` after changing the schema.'
  ].join('\n'),
  additionalProperties: false,
  style: { semi: false, singleQuote: true }
})

const alias = `\nexport type UconfigDocument = ${rootName}\n`
writeFileSync(outPath, body + alias)
console.log(`schema types: ${outPath.replace(root + '/', '')}`)
