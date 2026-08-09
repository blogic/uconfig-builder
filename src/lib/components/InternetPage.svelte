<script lang="ts">
  // Is the internet alright. Throughput belongs here rather than on a page of
  // its own: a graph answers nothing without the address and lease beside it.
  import Gauge from './Gauge.svelte'
  import TrafficChart from './TrafficChart.svelte'
  import { network, ports, uplink, local } from '../netstate.svelte.js'
  import { traffic, RESOLUTIONS, rates, current, has_traffic } from '../traffic.svelte.js'
  import { bytes_format, uptime_format } from '../device-icons.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const ranges = RESOLUTIONS.filter((r) => r.key !== 'live')
  let selected = $state('hour')

  const res = $derived(ranges.find((r) => r.key === selected) ?? ranges[0])
  const down = $derived(rates('down', res))
  const up = $derived(rates('up', res))
  const empty = $derived(traffic.data != null && !has_traffic())

  function span_label(key: string): string {
    if (key === 'day') return t('24 hours ago')
    if (key === 'week') return t('7 days ago')
    return t('60 minutes ago')
  }

  const wan = $derived(uplink(network.data)?.[1] ?? null)
  const wanPort = $derived(
    Object.entries(ports.data ?? {}).find(([name]) => name.startsWith('WAN'))?.[1] ?? null
  )

  const v4 = $derived(wan?.ipv4)
  const v6 = $derived(wan?.ipv6)
  const carrier = $derived(wanPort?.carrier !== false)
  const addressed = $derived(!!v4?.address || !!v6?.addresses?.length)

  // Two different failures, and sending someone to swap a working cable is the
  // cost of not telling them apart. A device with no uplink at all is a third
  // thing again: an access point behind someone else's router, working exactly
  // as intended.
  const headline = $derived(
    !wan
      ? t('This device does not manage the internet connection')
      : addressed
        ? t('Connected')
        : carrier
          ? t('No address from your provider')
          : t('No cable in the WAN socket')
  )
  const explain = $derived(
    !wan
      ? t('It has no upstream interface of its own. Whatever router it is plugged into handles the connection.')
      : addressed
        ? null
        : carrier
          ? t('The cable is connected and the link is up, but nothing has handed this device an address.')
          : t('Nothing is plugged into the socket marked WAN. Until something is, this device has no route to the internet and neither do its clients.')
  )

  // The lease is reported as a duration; what anyone wants is when it runs out,
  // and "864000 seconds" is not an answer.
  const renews = $derived(
    v4?.lease?.time ? uptime_format(Math.max(0, v4.lease.time - (wan?.uptime ?? 0))) : null
  )

  // Whether the delegation actually reached the local side. A ULA is always
  // there and proves nothing, so it does not count as an answer.
  const delegated = $derived(
    local(network.data)
      .flatMap(([, i]) => i.ipv6?.assigned ?? [])
      .find((a) => !a.startsWith('fd')) ?? null
  )

  $effect(() => poll_feed('network'))
  $effect(() => poll_feed('ports'))
  $effect(() => poll_feed('traffic'))
</script>

{#if network.error && !network.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{network.error}</div>
{:else}
  <div class="mb-4 flex flex-wrap items-center gap-2">
    <h2 class="text-base font-semibold text-zinc-900">{headline}</h2>
    {#if addressed}
      {#if wanPort?.speed}
        <span class="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
          {t('{speed} Mbit/s', { speed: wanPort.speed })}
        </span>
      {/if}
      {#if wan?.uptime}
        <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
          {t('up {time}', { time: uptime_format(wan.uptime) })}
        </span>
      {/if}
    {/if}
  </div>

  {#if explain}
    <p class="page-description">{explain}</p>
  {/if}

  {#if addressed}
    <div class="mb-6 flex justify-center gap-10">
      <Gauge value={current('down')} label="Download" />
      <Gauge value={current('up')} label="Upload" muted />
    </div>

    <div class="tab-row">
      {#each ranges as r (r.key)}
        <button
          type="button"
          class="tab-button {selected === r.key ? 'tab-button-active' : ''}"
          onclick={() => (selected = r.key)}
        >
          {t(r.label)}
        </button>
      {/each}
    </div>

    {#if empty}
      <p class="rounded-base bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
        {t('No traffic recorded yet.')}
      </p>
    {:else}
      <TrafficChart {down} {up} leftLabel={span_label(res.key)} rightLabel={t('now')} />
    {/if}
  {/if}

  {#if wan}
  <div class="mt-6 grid gap-4 sm:grid-cols-2">
    <div class="rounded-base border border-zinc-200 bg-surface p-4">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">{t('Uplink')}</h3>
        {#if v4?.proto}
          <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
            {v4.proto}
          </span>
        {/if}
      </div>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Address')}</dt><dd class="truncate text-zinc-800">{v4?.address ?? '—'}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Gateway')}</dt><dd class="truncate text-zinc-800">{v4?.gateway ?? '—'}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('DNS')}</dt><dd class="truncate text-zinc-800">{v4?.dns?.join(', ') || '—'}</dd></div>
        {#if v4?.lease?.server}
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Lease from')}</dt><dd class="truncate text-zinc-800">{v4.lease.server}</dd></div>
        {/if}
        {#if renews}
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Renews in')}</dt><dd class="truncate text-zinc-800">{renews}</dd></div>
        {/if}
      </dl>
    </div>

    <div class="rounded-base border border-zinc-200 bg-surface p-4">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">{t('IPv6')}</h3>
        {#if v6?.proto}
          <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
            {v6.proto}
          </span>
        {/if}
      </div>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Address')}</dt><dd class="truncate font-mono text-xs text-zinc-800">{v6?.addresses?.[0] ?? '—'}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Delegated to us')}</dt><dd class="truncate font-mono text-xs text-zinc-800">{v6?.prefix ?? '—'}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Used on your network')}</dt><dd class="truncate font-mono text-xs text-zinc-800">{delegated ?? '—'}</dd></div>
      </dl>
    </div>

    {#if wanPort}
    <div class="rounded-base border border-zinc-200 bg-surface p-4 sm:col-span-2">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">{t('Socket')}</h3>
        <span
          class="rounded-full px-2 py-0.5 text-[11px] font-semibold {carrier
            ? 'bg-accent/10 text-accent'
            : 'bg-zinc-100 text-zinc-500'}"
        >
          {carrier ? t('Link up') : t('Link down')}
        </span>
      </div>
      <div class="mt-2 flex items-center gap-3 text-sm {carrier ? 'text-zinc-800' : 'text-zinc-400'}">
        <span class="w-14 font-semibold">{t('WAN')}</span>
        <span>
          {carrier ? t('{speed} Mbit/s', { speed: wanPort?.speed ?? '—' }) : t('No cable')}
          {#if wanPort?.netdev}<span class="text-zinc-400"> · {wanPort.netdev}</span>{/if}
        </span>
        <span class="ml-auto tabular-nums text-zinc-500">
          ↓ {bytes_format(wanPort?.rx_bytes ?? 0)} &nbsp; ↑ {bytes_format(wanPort?.tx_bytes ?? 0)}
        </span>
      </div>
    </div>
    {/if}
  </div>
  {/if}
{/if}
