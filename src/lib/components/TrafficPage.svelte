<script lang="ts">
  import Gauge from './Gauge.svelte'
  import TrafficChart from './TrafficChart.svelte'
  import { traffic, RESOLUTIONS, rates, current, has_traffic } from '../traffic.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  // Live drives the gauges; the chart shows the selected history.
  const ranges = RESOLUTIONS.filter((r) => r.key !== 'live')
  let selected = $state('hour')

  const res = $derived(ranges.find((r) => r.key === selected) ?? ranges[0])
  const down = $derived(rates('down', res))
  const up = $derived(rates('up', res))
  const empty = $derived(traffic.data != null && !has_traffic())

  const spans: Record<string, string> = {
    hour: '60 minutes ago',
    day: '24 hours ago',
    week: '7 days ago'
  }


  // Refresh on arrival, then poll while this page is open.
  $effect(() => poll_feed('traffic'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.traffic)}</p>

{#if traffic.error && !traffic.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{traffic.error}</div>
{:else}
  <div class="mb-6 flex justify-center gap-10">
    <Gauge value={current('down')} label="Download" />
    <Gauge value={current('up')} label="Upload" muted />
  </div>

  <div class="tab-row">
    {#each ranges as r (r.key)}
      <button type="button" class="tab-button {selected === r.key ? 'tab-button-active' : ''}" onclick={() => (selected = r.key)}>
        {t(r.label)}
      </button>
    {/each}
  </div>

  {#if empty}
    <p class="rounded-base bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
      {t('No traffic recorded yet.')}
    </p>
  {:else}
    <TrafficChart {down} {up} leftLabel={t(spans[res.key])} rightLabel={t('now')} />
  {/if}
{/if}
