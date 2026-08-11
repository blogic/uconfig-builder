<script lang="ts">
  import { capabilities } from '../capabilities.svelte.js'
  import { sysinfo } from '../sysinfo.svelte.js'
  import { cpu, cpu_current, cpu_window_s } from '../cpu.svelte.js'
  import { thermal, thermal_peak, thermal_window_s } from '../thermal.svelte.js'
  import SeriesChart from './SeriesChart.svelte'
  import { poll_feed } from '../poll.svelte.js'
  import { uptime_format } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { t } from '../i18n.svelte.js'

  // Held in a module store so re-entering the page renders the last reading
  // straight away, with the refresh landing underneath it.
  const info = $derived(sysinfo.data)
  const error = $derived(sysinfo.error)

  // What the device is and how hard it is working. What it has left, memory and
  // flash both, is the Memory page: two gauges belong beside each other rather
  // than one on each page.
  const model = $derived(capabilities.data?.capabilities?.model)
  const board = $derived(sysinfo.board)

  // Utilisation rather than the load average this card used to show. loadavg
  // counts tasks blocked in uninterruptible sleep as well as runnable ones, so a
  // device stalled on flash reads as loaded with an idle CPU, and its 1/5/15
  // minute time constants cannot resolve anything shorter than a minute. The
  // device computes these from /proc/stat instead. `info.load` is still in
  // `system-info` for anyone who wants the run queue.
  const usage = $derived(cpu.data?.usage ?? [])
  const current = $derived(cpu_current())
  const cpu_min = $derived(Math.round(cpu_window_s() / 60))

  // Which sensors exist is the board's business, so the card lists whatever
  // arrives and charts the warmest of them. No severity colouring: the device
  // reports no thresholds, and a number invented here would be wrong on the
  // next board. The axis runs to 120C instead, which covers the critical point
  // of the parts seen so far without flattering a hot device.
  const sensors = $derived(thermal.data?.sensors ?? [])
  const hottest = $derived(thermal_peak())
  const thermal_min = $derived(Math.round(thermal_window_s() / 60))
  const TEMP_FULL = 120

  // Refresh on arrival, then poll while this page is open.
  $effect(() => poll_feed('state'))
  $effect(() => poll_feed('cpu'))
  $effect(() => poll_feed('thermal'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.state)}</p>

{#if error && !info}
  <div class="rounded-base border border-zinc-200 bg-surface p-4 text-sm text-red-600">{error}</div>
{/if}

<div class="grid gap-4 sm:grid-cols-2">
  <div class="rounded-base border border-zinc-200 bg-surface p-4">
    <h3 class="text-sm font-semibold text-zinc-900">{t('Device')}</h3>
    <dl class="mt-2 space-y-1 text-sm">
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Model')}</dt><dd class="truncate text-zinc-800">{model ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Firmware')}</dt><dd class="truncate text-zinc-800">{board?.release?.description ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Target')}</dt><dd class="truncate font-mono text-xs text-zinc-800">{board?.release?.target ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Kernel')}</dt><dd class="font-mono text-xs text-zinc-800">{board?.kernel ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('CPU')}</dt><dd class="truncate text-zinc-800">{board?.system ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Uptime')}</dt><dd class="text-zinc-800">{uptime_format(info?.uptime)}</dd></div>
    </dl>
  </div>

  <div class="rounded-base border border-zinc-200 bg-surface p-4">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="text-sm font-semibold text-zinc-900">{t('CPU usage')}</h3>
      <span class="text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
        {current ?? '—'}<span class="ml-0.5 text-sm font-medium text-zinc-500">%</span>
      </span>
    </div>
    {#if usage.length}
      <SeriesChart
        values={usage}
        capacity={cpu.data?.samples ?? 0}
        unit="%"
        leftLabel={t('{count} min ago', { count: cpu_min })}
        rightLabel={t('now')}
      />
    {:else}
      <p class="mt-2 text-sm text-zinc-500">{t('This device does not report CPU usage.')}</p>
    {/if}
  </div>

  <div class="rounded-base border border-zinc-200 bg-surface p-4">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="text-sm font-semibold text-zinc-900">{t('Temperature')}</h3>
      <span class="text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
        {hottest?.temp_c ?? '—'}<span class="ml-0.5 text-sm font-medium text-zinc-500">°C</span>
      </span>
    </div>
    {#if hottest}
      <dl class="mt-2 space-y-1 text-sm">
        {#each sensors as s (s.name)}
          <div class="flex justify-between gap-4">
            <dt class="truncate font-mono text-xs text-zinc-500">{s.name}</dt>
            <dd class="tabular-nums text-zinc-800">{s.temp_c} °C</dd>
          </div>
        {/each}
      </dl>
      <SeriesChart
        values={hottest.history}
        capacity={thermal.data?.samples ?? 0}
        full={TEMP_FULL}
        unit=" °C"
        fill="fill-zinc-400/70"
        leftLabel={t('{count} min ago', { count: thermal_min })}
        rightLabel={t('now')}
      />
      <p class="mt-1 text-xs text-zinc-500">
        {t('Charted: {name}, the warmest sensor.', { name: hottest.name })}
      </p>
    {:else}
      <p class="mt-2 text-sm text-zinc-500">{t('This device does not report temperatures.')}</p>
    {/if}
  </div>
</div>
