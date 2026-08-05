<script lang="ts">
  import Field from './Field.svelte'
  import ArrayListField from './ArrayListField.svelte'
  import ChannelField from './ChannelField.svelte'
  import ChannelWidthField from './ChannelWidthField.svelte'
  import ChannelModeField from './ChannelModeField.svelte'
  import TxPowerField from './TxPowerField.svelte'
  import AddressingField from './AddressingField.svelte'
  import AddressingReadonly from './AddressingReadonly.svelte'
  import TimezoneField from './TimezoneField.svelte'
  import DisallowUpstreamSection from './DisallowUpstreamSection.svelte'
  import MapListField from './MapListField.svelte'
  import PortsSection from './PortsSection.svelte'
  import VlanSection from './VlanSection.svelte'
  import DhcpPoolSection from './DhcpPoolSection.svelte'
  import MapEditor from './MapEditor.svelte'
  import CollapsibleSection from './CollapsibleSection.svelte'
  import ToggleSection from './ToggleSection.svelte'
  import NameAddForm from './NameAddForm.svelte'
  import BandsField from './BandsField.svelte'
  import ChoiceListField from './ChoiceListField.svelte'
  import ServicesField from './ServicesField.svelte'
  import AclField from './AclField.svelte'
  import MultiPskField from './MultiPskField.svelte'
  import SchemaObject from './SchemaObject.svelte'
  import Self from './LayoutRenderer.svelte'
  import { ref_resolve, schema_at, pattern_value_schema, title_for } from '../schema.js'
  import { accordion_provide } from '../accordion.svelte.js'
  import type { JsonSchemaNode } from '../schema'
  import type { LayoutNode, LayoutContext } from '../layouts'
  import type { Interface, Interface1, Radio, Unit } from '../types/uconfig'

  type LeafValue = string | number | boolean | (string | number)[] | undefined
  type LeafObj = Record<string, LeafValue>

  interface Props {
    data: Record<string, unknown>
    schema: JsonSchemaNode
    layout: LayoutNode[]
    context?: LayoutContext
  }

  let { data, schema, layout, context = {} }: Props = $props()

  accordion_provide(true)

  // Object sections (e.g. ipv4/ipv6) are always present.
  const ensurePaths = $derived(
    layout.filter((n): n is LayoutNode & { objectSection: string } => n.objectSection != null).map((n) => n.objectSection)
  )
  $effect(() => {
    for (const p of ensurePaths) walk(data, p, true)
  })

  // Keep the document in sync with what is shown: when a node is hidden by its
  // `when` predicate, remove its data so the JSON never carries stale values.
  $effect(() => {
    for (const node of layout) {
      if (node.when && !node.when({ data, context })) {
        for (const p of prune_paths(node)) delete_at(data, p)
      }
    }
  })

  function prune_paths(node: LayoutNode): string[] {
    if (node.field) return [node.field]
    if (node.objectSection) return [node.objectSection]
    if (node.toggleSection) return [node.toggleSection]
    if (node.mapSection) return [node.mapSection]
    if (node.mapList) return [node.mapList]
    if (node.multiPsk) return ['multi-psk']
    if (node.disallow) return [`${node.disallow}.disallow-upstream-subnet`]
    if (node.dhcpSection) return ['ipv4.dhcp-pool', 'ipv4.dhcp-leases']
    return []
  }

  function delete_at(o: Record<string, unknown>, path: string) {
    const segs = path.split('.')
    const last = segs.pop()!
    let cur = o
    for (const s of segs) {
      const next = cur[s]
      if (next == null || typeof next !== 'object') return
      cur = next as Record<string, unknown>
    }
    delete cur[last]
  }

  function walk(o: Record<string, unknown>, path: string | undefined, create = false): Record<string, unknown> | undefined {
    if (!path) return o
    let cur = o
    for (const seg of path.split('.')) {
      let next = cur[seg]
      if (next == null) {
        if (!create) return undefined
        next = {}
        cur[seg] = next
      }
      cur = next as Record<string, unknown>
    }
    return cur
  }

  function parent_of(path: string): Record<string, unknown> {
    const dot = path.lastIndexOf('.')
    return dot < 0 ? data : (walk(data, path.slice(0, dot), true) as Record<string, unknown>)
  }
  function leaf_of(path: string): string {
    const dot = path.lastIndexOf('.')
    return dot < 0 ? path : path.slice(dot + 1)
  }
  function show(node: LayoutNode): boolean {
    return !node.when || node.when({ data, context })
  }
  function req_of(node: LayoutNode): boolean {
    return typeof node.required === 'function' ? node.required({ data, context }) : !!node.required
  }
  function obj_branch(s: JsonSchemaNode): JsonSchemaNode {
    if (s.type === 'object' || s.properties) return s
    const br = s.anyOf || s.oneOf || []
    return br.map(ref_resolve).find((b) => b.type === 'object' || b.properties) ?? s
  }
</script>

<div class="flex flex-col gap-4">
  {#each layout as node, i (i)}
    {#if show(node)}
      {#if node.field}
        {@const parent = parent_of(node.field)}
        {@const fkey = leaf_of(node.field)}
        {@const fs0 = schema_at(schema, node.field)}
        {@const cur = parent[fkey]}
        {@const enumOpts = node.options
          ? cur != null && !node.options.includes(cur)
            ? [...node.options, cur]
            : node.options
          : null}
        {@const fs = enumOpts ? { ...fs0, enum: enumOpts } : fs0}
        {@const w = node.widget ?? (fs.type === 'array' ? 'list' : 'field')}
        {#if w === 'field'}
          <Field obj={parent as LeafObj} key={fkey} schema={fs} required={req_of(node)} label={node.label ?? null} fallback={node.default as LeafValue} describe={node.describe ?? null} />
        {:else if w === 'list'}
          <ArrayListField obj={parent as LeafObj} key={fkey} schema={fs} label={node.label ?? null} describe={node.describe ?? null} />
        {:else if w === 'channel'}
          <ChannelField obj={parent as Radio} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
        {:else if w === 'channel-width'}
          <ChannelWidthField obj={parent as Radio} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
        {:else if w === 'channel-mode'}
          <ChannelModeField obj={parent as Radio} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
        {:else if w === 'tx-power'}
          <TxPowerField obj={parent as Radio} describe={node.describe ?? null} />
        {:else if w === 'addressing'}
          <AddressingField obj={parent as { addressing?: string }} schema={fs} role={context.role} describe={node.describe ?? null} />
        {:else if w === 'addressing-ro'}
          <AddressingReadonly obj={parent as { addressing?: string }} />
        {:else if w === 'timezone'}
          <TimezoneField obj={parent as Unit} />
        {:else if w === 'bands'}
          <BandsField obj={parent} {context} />
        {:else if w === 'choice'}
          <ChoiceListField obj={parent as Record<string, string[] | undefined>} key={fkey} options={(node.options ?? []) as string[]} label={node.label ?? null} />
        {:else if w === 'services'}
          <ServicesField obj={parent} {context} />
        {/if}
      {:else if node.section}
        <CollapsibleSection title={node.section}>
          {#snippet children()}
            <Self {data} {schema} layout={node.children ?? []} {context} />
          {/snippet}
        </CollapsibleSection>
      {:else if node.objectSection}
        {@const target = walk(data, node.objectSection)}
        {@const ts = schema_at(schema, node.objectSection)}
        <CollapsibleSection title={node.title ?? title_for(node.objectSection)}>
          {#snippet children()}
            {#if target}
              {#if node.children}
                <Self data={target} schema={ts} layout={node.children} {context} />
              {:else}
                <SchemaObject obj={target} schema={ts} />
              {/if}
            {/if}
          {/snippet}
        </CollapsibleSection>
      {:else if node.toggleSection}
        {@const parent = parent_of(node.toggleSection)}
        {@const tkey = leaf_of(node.toggleSection)}
        {@const ts = obj_branch(schema_at(schema, node.toggleSection))}
        {#if parent}
          <ToggleSection container={parent} key={tkey} title={node.title ?? title_for(tkey)}>
            {#snippet children()}
              {#if node.children}
                <Self data={parent[tkey] as Record<string, unknown>} schema={ts} layout={node.children} {context} />
              {:else}
                <SchemaObject obj={parent[tkey] as Record<string, unknown>} schema={ts} />
              {/if}
            {/snippet}
          </ToggleSection>
        {/if}
      {:else if node.mapSection}
        {@const mapSection = node.mapSection}
        {@const ms = schema_at(schema, mapSection)}
        {@const vs = pattern_value_schema(ms) ?? {}}
        <CollapsibleSection title={node.title ?? title_for(node.mapSection)}>
          {#snippet children()}
            {#if node.tabbed}
              <MapEditor parent={data} mapKey={mapSection} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} tabbed renamable={node.renamable ?? true}>
                {#snippet item(entry: Record<string, unknown>)}
                  {#if node.item}
                    <Self data={entry} schema={vs} layout={node.item} {context} />
                  {:else}
                    <SchemaObject obj={entry} schema={vs} />
                  {/if}
                {/snippet}
                {#snippet addModal({ create, close, map }: { create: (name: string, value: Record<string, unknown>) => void, close: () => void, map: Record<string, unknown> })}
                  <NameAddForm existing={map} keyLabel={node.keyLabel ?? 'entry'} onCreate={create} {close} />
                {/snippet}
              </MapEditor>
            {:else}
              <MapEditor parent={data} mapKey={mapSection} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} embedded>
                {#snippet item(entry: Record<string, unknown>)}
                  {#if node.item}
                    <Self data={entry} schema={vs} layout={node.item} {context} />
                  {:else}
                    <SchemaObject obj={entry} schema={vs} />
                  {/if}
                {/snippet}
              </MapEditor>
            {/if}
          {/snippet}
        </CollapsibleSection>
      {:else if node.aclField}
        <AclField obj={data} />
      {:else if node.multiPsk}
        <MultiPskField obj={data} />
      {:else if node.portsSection}
        <PortsSection
          iface={data as Interface}
          interfaces={(context.allInterfaces ?? {}) as Record<string, Interface>}
          selfName={context.selfName ?? ''}
          role={context.role}
        />
      {:else if node.vlanSection}
        {#if data.vlan != null}
          <VlanSection
            iface={data as Interface}
            interfaces={(context.allInterfaces ?? {}) as Record<string, Interface>}
            selfName={context.selfName ?? ''}
            role={context.role}
          />
        {/if}
      {:else if node.dhcpSection}
        {@const ipv4 = walk(data, 'ipv4', true)}
        {#if ipv4}
          <DhcpPoolSection ipv4={ipv4 as Interface1} />
        {/if}
      {:else if node.mapList}
        {@const vs = pattern_value_schema(schema_at(schema, node.mapList))}
        <MapListField container={data} mapKey={node.mapList} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} />
      {:else if node.disallow}
        {@const obj = walk(data, node.disallow, true)}
        {@const ds = ref_resolve(schema_at(schema, node.disallow).properties?.['disallow-upstream-subnet'] ?? {})}
        {#if obj}
          <DisallowUpstreamSection {obj} schema={ds} />
        {/if}
      {/if}
    {/if}
  {/each}
</div>
