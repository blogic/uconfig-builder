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
  import DhcpRangeSection from './DhcpRangeSection.svelte'
  import GuestVlanField from './GuestVlanField.svelte'
  import MapEditor from './MapEditor.svelte'
  import CollapsibleSection from './CollapsibleSection.svelte'
  import PlainSection from './PlainSection.svelte'
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
  import type { Interface, Interface1 } from '../types/uconfig'

  type LeafValue = string | number | boolean | (string | number)[] | undefined

  interface Props {
    // Structural, and deliberately wide: casting at a call site makes a new
    // expression and breaks Svelte's ownership tracking for mutations.
    data: Record<string, unknown>
    schema: JsonSchemaNode
    layout: LayoutNode[]
    context?: LayoutContext
  }

  let { data, schema, layout, context = {} }: Props = $props()

  // Narrowed once here rather than at every call site, so callers hand over
  // their state object unwrapped.
  const data_obj = $derived(data as Record<string, unknown>)

  // Writes happen here, on the object this component was given, rather than
  // inside the field widgets: a child mutating a prop it does not own is what
  // Svelte reports as ownership_invalid_mutation.
  function field_set(target: Record<string, unknown>, k: string, v: unknown) {
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }

  accordion_provide(true)

  // Object sections (e.g. ipv4/ipv6) are always present, as is the container of
  // a dotted field path (e.g. the dhcpv6 of dhcpv6.mode). Creating either one
  // while rendering is what Svelte reports as state_unsafe_mutation, so both are
  // materialised here instead.
  const ensurePaths = $derived([
    ...layout.filter((n) => n.objectSection != null).map((n) => n.objectSection as string),
    ...layout.filter((n) => n.field?.includes('.')).map((n) => (n.field as string).replace(/\.[^.]+$/, ''))
  ])
  $effect(() => {
    for (const p of ensurePaths) walk(data_obj, p, true)
  })

  // Keep the document in sync with what is shown: when a node is hidden by its
  // `when` predicate, remove its data so the JSON never carries stale values.
  $effect(() => {
    for (const node of layout) {
      if (node.when && !node.when({ data: data_obj, context })) {
        for (const p of prune_paths(node)) delete_at(data_obj, p)
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

  // Read-only: the ensure effect above owns creation. Undefined until it has
  // run, which the callers guard for.
  function parent_of(path: string): Record<string, unknown> | undefined {
    const dot = path.lastIndexOf('.')
    return dot < 0 ? data_obj : walk(data_obj, path.slice(0, dot))
  }
  function leaf_of(path: string): string {
    const dot = path.lastIndexOf('.')
    return dot < 0 ? path : path.slice(dot + 1)
  }
  function show(node: LayoutNode): boolean {
    return !node.when || node.when({ data: data_obj, context })
  }
  function req_of(node: LayoutNode): boolean {
    return typeof node.required === 'function' ? node.required({ data: data_obj, context }) : !!node.required
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
        {#if parent}
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
            <Field obj={parent} key={fkey} onset={(k, v) => field_set(parent, k, v)} schema={fs} required={req_of(node)} label={node.label ?? null} fallback={node.default as LeafValue} describe={node.describe ?? null} />
          {:else if w === 'list'}
            <ArrayListField obj={parent} onset={(k, v) => field_set(parent, k, v)} key={fkey} schema={fs} label={node.label ?? null} describe={node.describe ?? null} />
          {:else if w === 'channel'}
            <ChannelField obj={parent} onset={(k, v) => field_set(parent, k, v)} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
          {:else if w === 'channel-width'}
            <ChannelWidthField obj={parent} onset={(k, v) => field_set(parent, k, v)} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
          {:else if w === 'channel-mode'}
            <ChannelModeField obj={parent} onset={(k, v) => field_set(parent, k, v)} schema={fs} band={context.band ?? ''} describe={node.describe ?? null} />
          {:else if w === 'tx-power'}
            <TxPowerField obj={parent} onset={(k, v) => field_set(parent, k, v)} describe={node.describe ?? null} />
          {:else if w === 'addressing'}
            <AddressingField obj={parent} onset={(k, v) => field_set(parent, k, v)} schema={fs} role={context.role} describe={node.describe ?? null} />
          {:else if w === 'addressing-ro'}
            <AddressingReadonly obj={parent} />
          {:else if w === 'timezone'}
            <TimezoneField obj={parent} onset={(k, v) => field_set(parent, k, v)} />
          {:else if w === 'bands'}
            <BandsField obj={parent} onset={(k, v) => field_set(parent, k, v)} {context} />
          {:else if w === 'choice'}
            <ChoiceListField obj={parent} onset={(k, v) => field_set(parent, k, v)} key={fkey} options={(node.options ?? []) as string[]} label={node.label ?? null} />
          {:else if w === 'services'}
            <ServicesField obj={parent} {context} />
          {/if}
        {/if}
      {:else if node.section}
        {@const Section = node.plain ? PlainSection : CollapsibleSection}
        <Section title={node.section}>
          {#snippet children()}
            <Self {data} {schema} layout={node.children ?? []} {context} />
          {/snippet}
        </Section>
      {:else if node.objectSection}
        {@const target = walk(data_obj, node.objectSection)}
        {@const ts = schema_at(schema, node.objectSection)}
        {@const Section = node.plain ? PlainSection : CollapsibleSection}
        <Section title={node.title ?? title_for(node.objectSection)}>
          {#snippet children()}
            {#if target}
              {#if node.children}
                <Self data={target} schema={ts} layout={node.children} {context} />
              {:else}
                <SchemaObject obj={target} onset={(k, v) => field_set(target as Record<string, unknown>, k, v)} schema={ts} />
              {/if}
            {/if}
          {/snippet}
        </Section>
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
                <SchemaObject obj={parent[tkey] as Record<string, unknown>} onset={(k, v) => field_set(parent[tkey] as Record<string, unknown>, k, v)} schema={ts} />
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
              <MapEditor parent={data_obj} mapKey={mapSection} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} tabbed renamable={node.renamable ?? true}>
                {#snippet item(entry: Record<string, unknown>)}
                  {#if node.item}
                    <Self data={entry} schema={vs} layout={node.item} {context} />
                  {:else}
                    <SchemaObject obj={entry} onset={(k, v) => field_set(entry as Record<string, unknown>, k, v)} schema={vs} />
                  {/if}
                {/snippet}
                {#snippet addModal({ create, close, map }: { create: (name: string, value: Record<string, unknown>) => void, close: () => void, map: Record<string, unknown> })}
                  <NameAddForm existing={map} keyLabel={node.keyLabel ?? 'entry'} onCreate={create} {close} />
                {/snippet}
              </MapEditor>
            {:else}
              <MapEditor parent={data_obj} mapKey={mapSection} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} embedded>
                {#snippet item(entry: Record<string, unknown>)}
                  {#if node.item}
                    <Self data={entry} schema={vs} layout={node.item} {context} />
                  {:else}
                    <SchemaObject obj={entry} onset={(k, v) => field_set(entry as Record<string, unknown>, k, v)} schema={vs} />
                  {/if}
                {/snippet}
              </MapEditor>
            {/if}
          {/snippet}
        </CollapsibleSection>
      {:else if node.aclField}
        <AclField obj={data} onset={(k, v) => field_set(data, k, v)} />
      {:else if node.multiPsk}
        <MultiPskField obj={data} onset={(k, v) => field_set(data, k, v)} />
      {:else if node.portsSection}
        <PortsSection
          iface={data as Interface}
          interfaces={(context.allInterfaces ?? {}) as Record<string, Interface>}
          selfName={context.selfName ?? ''}
          role={context.role}
        />
      {:else if node.vlanSection}
        <!-- An upstream carries trunks whether or not it has a VLAN of its own,
             so the section is offered when either applies. -->
        {#if data_obj.vlan != null || context.role === 'upstream'}
          <VlanSection
            iface={data as Interface}
            interfaces={(context.allInterfaces ?? {}) as Record<string, Interface>}
            selfName={context.selfName ?? ''}
            role={context.role}
          />
        {/if}
      {:else if node.dhcpSection}
        {@const ipv4 = walk(data_obj, 'ipv4', true)}
        {#if ipv4}
          <DhcpPoolSection ipv4={ipv4 as Interface1} />
        {/if}
      {:else if node.dhcpRange}
        <!-- Nested inside an ipv4 objectSection, so the data object is already
             the ipv4 block rather than the interface. -->
        <DhcpRangeSection ipv4={data_obj} />
      {:else if node.guestVlan}
        <GuestVlanField />
      {:else if node.mapList}
        {@const vs = pattern_value_schema(schema_at(schema, node.mapList))}
        <MapListField container={data_obj} mapKey={node.mapList} valueSchema={vs} keyLabel={node.keyLabel ?? 'entry'} />
      {:else if node.disallow}
        {@const obj = walk(data_obj, node.disallow, true)}
        {@const ds = ref_resolve(schema_at(schema, node.disallow).properties?.['disallow-upstream-subnet'] ?? {})}
        {#if obj}
          <DisallowUpstreamSection {obj} onset={(k, v) => field_set(obj, k, v)} schema={ds} />
        {/if}
      {/if}
    {/if}
  {/each}
</div>
