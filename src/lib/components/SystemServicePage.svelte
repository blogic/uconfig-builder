<script lang="ts">
  // A service as the live app presents it: what it does, one switch, and the
  // networks it is offered on.
  //
  // The switch writes two places. The device starts most services from the
  // interfaces naming them rather than from the settings block, so a switch that
  // wrote only the block would claim to turn something on without doing it.
  import ChangesIndicator from './ChangesIndicator.svelte'
  import LayoutRenderer from './LayoutRenderer.svelte'
  import PageHeader from './PageHeader.svelte'
  import { def_get, schema_at } from '../schema.js'
  import { iface_enabled } from '../interfaces.js'
  import { primary_iface, serviceIntentLayouts } from '../layouts.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { system_service } from '../services.js'
  import {
    store,
    service_enabled,
    service_enable,
    service_disable,
    service_ifaces,
    service_iface_set
  } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    serviceKey: string
    changes?: ChangeEntry[]
  }

  let { serviceKey, changes = [] }: Props = $props()

  const meta = $derived(system_service(serviceKey))
  const schema = $derived(schema_at(def_get('service') ?? {}, serviceKey))
  const layout = $derived(serviceIntentLayouts[serviceKey] ?? [])
  const data = $derived(
    (store.doc.services as Record<string, Record<string, unknown> | undefined> | undefined)?.[serviceKey]
  )

  // A disabled interface is dropped by the device before anything renders, so
  // it can offer nothing and is not worth asking about.
  const networks = $derived(
    Object.entries((store.doc.interfaces ?? {}) as Record<string, Record<string, unknown>>)
      .filter(([, v]) => iface_enabled(v as { disable?: boolean }))
      .map(([name]) => name)
  )
  const offered = $derived(service_ifaces(serviceKey))

  // With no network of its own, the block existing is the whole of what starts
  // it. A service the device runs regardless is simply on.
  const enabled = $derived(
    meta?.always ? true : meta?.networks ? offered.length > 0 : service_enabled(serviceKey)
  )

  // Its settings need somewhere to live, and the block carrying nothing but
  // schema defaults reads as no change, so materialising it costs nothing.
  $effect(() => {
    if (meta?.always && !service_enabled(serviceKey)) service_enable(serviceKey)
  })

  function toggle() {
    if (!meta) return
    if (!meta.networks) {
      if (enabled) service_disable(serviceKey)
      else service_enable(serviceKey)
      return
    }
    // Off clears the networks and leaves the settings alone, so the port, keys
    // and announced names are still there when the service comes back.
    if (enabled) {
      for (const name of offered) service_iface_set(serviceKey, name, false)
      return
    }
    service_enable(serviceKey)
    const first = primary_iface(store.doc.interfaces as Record<string, unknown>)?.[0]
    if (first) service_iface_set(serviceKey, first, true)
  }
</script>

<PageHeader title={meta?.label ?? serviceKey}>
  {#snippet actions()}
    <ChangesIndicator {changes} scope="service:{serviceKey}" />
  {/snippet}
</PageHeader>

{#if PAGE_DESCRIPTIONS[`svc:${serviceKey}`]}
  <p class="page-description">{t(PAGE_DESCRIPTIONS[`svc:${serviceKey}`])}</p>
{/if}

<div class="flex max-w-sm flex-col gap-4">
  {#if !meta?.always}
    <div class="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t(meta?.label ?? serviceKey)}
        onclick={toggle}
        class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition {enabled
          ? 'bg-accent'
          : 'bg-zinc-300'}"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition {enabled
            ? 'translate-x-4'
            : 'translate-x-0.5'}"
        ></span>
      </button>
      <span class="text-sm font-semibold text-zinc-900">{t(meta?.label ?? serviceKey)}</span>
    </div>
  {/if}

  {#if enabled && meta?.networks}
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-zinc-700">{t('Offered on')}</span>
      {#each networks as name (name)}
        {@const on = offered.includes(name)}
        <div class="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={name}
            onclick={() => service_iface_set(serviceKey, name, !on)}
            class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition {on
              ? 'bg-accent'
              : 'bg-zinc-300'}"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition {on
                ? 'translate-x-4'
                : 'translate-x-0.5'}"
            ></span>
          </button>
          <span class="text-xs font-medium text-zinc-700">{name}</span>
        </div>
      {/each}
      <p class="text-[11px] leading-snug text-zinc-500">
        {t('The networks this service answers on. Turning them all off stops it, and keeps its settings.')}
      </p>
    </div>
  {/if}
</div>

{#if enabled && data}
  <div class={meta?.always ? '' : 'mt-4'}>
    <LayoutRenderer {data} {schema} {layout} />
  </div>
{/if}
