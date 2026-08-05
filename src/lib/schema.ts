import rootSchema from './data/schema.json'

export { rootSchema }

export interface JsonSchemaNode {
  $ref?: string
  type?: string
  properties?: Record<string, JsonSchemaNode>
  patternProperties?: Record<string, JsonSchemaNode>
  anyOf?: JsonSchemaNode[]
  oneOf?: JsonSchemaNode[]
  allOf?: JsonSchemaNode[]
  items?: JsonSchemaNode
  enum?: unknown[]
  default?: unknown
  [key: string]: unknown
}

export function ref_resolve(schema: JsonSchemaNode): JsonSchemaNode {
  let node: JsonSchemaNode | undefined = schema
  let guard = 0
  while (node && node.$ref && guard++ < 32) {
    const path = node.$ref.replace(/^#\//, '').split('/')
    let target: unknown = rootSchema
    for (const seg of path) target = (target as Record<string, unknown> | undefined)?.[decode_pointer(seg)]
    node = target as JsonSchemaNode | undefined
  }
  return node ?? schema
}

function decode_pointer(seg: string): string {
  return seg.replace(/~1/g, '/').replace(/~0/g, '~')
}

export function def_get(name: string): JsonSchemaNode | undefined {
  return (rootSchema.$defs as Record<string, JsonSchemaNode> | undefined)?.[name]
}

export function prop_schema(parent: JsonSchemaNode, key: string): JsonSchemaNode {
  const resolved = ref_resolve(parent)
  return ref_resolve(resolved?.properties?.[key] ?? {})
}

export function schema_at(root: JsonSchemaNode, path: string | undefined): JsonSchemaNode {
  let node = ref_resolve(root)
  if (!path) return node
  for (const seg of path.split('.')) {
    node = ref_resolve(node?.properties?.[seg] ?? {})
  }
  return node
}

export function pattern_value_schema(parent: JsonSchemaNode): JsonSchemaNode | null {
  const resolved = ref_resolve(parent)
  const pp = resolved?.patternProperties
  if (!pp) return null
  const first = Object.values(pp)[0]
  return first ? ref_resolve(first) : null
}

export { title_for } from './labels'
