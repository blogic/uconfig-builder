<script lang="ts">
  // What the device has left and which process is eating it: memory, flash, and
  // the per-process figures behind the first of those.
  //
  // Memory comes from `memory` and never from `system-info`. Both report free
  // memory, in different units and sampled at different instants, so a page
  // mixing them would show two totals that disagree. Flash has no such twin, so
  // it is read from `system-info` here without that hazard.
  import { memory, process_name, process_service } from '../diagnostics.svelte.js'
  import type { ProcessState } from '../diagnostics.svelte.js'
  import { sysinfo } from '../sysinfo.svelte.js'
  import UsageGauge from './UsageGauge.svelte'
  import { bytes_format } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const HEAD = 8

  let allGrown = $state(false)
  let allSteady = $state(false)

  const sys = $derived(memory.data?.system ?? null)
  const used = $derived(sys ? sys.total_kb - sys.available_kb : 0)

  // The memory watcher is an optional package; flash is not. Kept apart from
  // `sys` so a device without the watcher still reports its disk.
  const root = $derived(sysinfo.data?.root ?? null)

  // The device calls these `leaking` and `stable`, and the page does not. Its
  // whole rule is `rss_delta > 0 || fds_delta > 0`, so any growth at all lands
  // in the first list: on real hardware that is 18 of 44 processes, the last of
  // them by 8 kB. Saying "leaking" would report a fault where there is none.
  const grown = $derived(memory.data?.leaking ?? [])
  const steady = $derived(memory.data?.stable ?? [])

  const kb = (v: number) => bytes_format(v * 1024)

  // The same severity ramp UsageGauge uses, applied to growth rather than to a
  // percentage: nothing here is a share of anything.
  function tone(p: ProcessState): string {
    if (p.rss_delta_kb > 10240) return 'text-red-600 font-semibold'
    if (p.rss_delta_kb > 1024) return 'text-amber-600 font-semibold'
    return 'text-zinc-500'
  }

  $effect(() => poll_feed('memory'))
  $effect(() => poll_feed('state'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.memory)}</p>

{#if sys || root}
  <div class="mb-6 flex flex-wrap items-start gap-12">
    {#if sys}
      <UsageGauge
        used={used * 1024}
        total={sys.total_kb * 1024}
        label="Memory"
        detail={t('{used} of {total}', { used: kb(used), total: kb(sys.total_kb) })}
      />
    {/if}
    {#if root}
      <UsageGauge
        used={root.used * 1024}
        total={root.total * 1024}
        label="Flash"
        detail={t('{used} of {total}', { used: kb(root.used), total: kb(root.total) })}
      />
    {/if}
  </div>
{/if}

{#if memory.error && !memory.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{memory.error}</div>
{:else if !sys}
  <p class="py-8 text-center text-sm text-zinc-500">{t('This device does not report memory.')}</p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="rounded-base border border-zinc-200 bg-surface p-4">
      <h3 class="text-sm font-semibold text-zinc-900">{t('System')}</h3>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Free')}</dt><dd class="tabular-nums text-zinc-800">{kb(sys.free_kb)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Buffers and cache')}</dt><dd class="tabular-nums text-zinc-800">{kb(sys.buff_cache_kb)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Available')}</dt><dd class="tabular-nums text-zinc-800">{kb(sys.available_kb)}</dd></div>
      </dl>
    </div>

    <div class="rounded-base border border-zinc-200 bg-surface p-4">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">{t('Processes')}</h3>
        <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
          {t('{count} watched', { count: grown.length + steady.length })}
        </span>
      </div>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Grown since first seen')}</dt><dd class="tabular-nums text-zinc-800">{grown.length}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Steady')}</dt><dd class="tabular-nums text-zinc-800">{steady.length}</dd></div>
        {#if grown.length}
          <div class="flex justify-between gap-4">
            <dt class="text-zinc-500">{t('Largest growth')}</dt>
            <dd class="truncate text-zinc-800">
              {process_name(grown[0])}, +{kb(grown[0].rss_delta_kb)}
            </dd>
          </div>
        {/if}
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Sampled')}</dt><dd class="text-zinc-800">{t('hourly')}</dd></div>
      </dl>
    </div>
  </div>

  {#snippet table(rows: ProcessState[], expanded: boolean, growth: boolean)}
    <div class="flex gap-3 border-b border-zinc-200 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
      <span class="min-w-0 flex-1">{t('Process')}</span>
      <span class="w-12 text-right">{t('PID')}</span>
      <span class="w-20 text-right">{t('RSS')}</span>
      <span class="w-20 text-right">{growth ? t('Growth') : ''}</span>
      <span class="w-10 text-right">{t('FDs')}</span>
    </div>
    {#each expanded ? rows : rows.slice(0, HEAD) as p (p.pid)}
      <div class="flex gap-3 border-t border-zinc-100 py-1 text-sm tabular-nums first:border-t-0">
        <span class="flex min-w-0 flex-1 items-baseline gap-1.5 truncate">
          <span class="truncate font-semibold text-zinc-900">{process_name(p)}</span>
          {#if process_service(p)}
            <span class="truncate text-xs font-normal text-zinc-400">{process_service(p)}</span>
          {/if}
        </span>
        <span class="w-12 text-right text-zinc-400">{p.pid}</span>
        <span class="w-20 text-right text-zinc-700">{kb(p.rss_kb)}</span>
        <span class="w-20 text-right {growth ? tone(p) : 'text-zinc-400'}"
          >{growth ? '+' + kb(p.rss_delta_kb) : '—'}</span
        >
        <span class="w-10 text-right text-zinc-400">{p.fds}</span>
      </div>
    {/each}
  {/snippet}

  {#if grown.length}
    <h3 class="mt-6 mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {t('Grown since first seen')}
    </h3>
    {@render table(grown, allGrown, true)}
    {#if grown.length > HEAD}
      <button
        type="button"
        class="mt-1 cursor-pointer text-xs text-accent hover:underline"
        onclick={() => (allGrown = !allGrown)}
      >
        {allGrown
          ? t('Show fewer')
          : t('and {count} more, none above {size}', {
              count: grown.length - HEAD,
              size: kb(grown[HEAD].rss_delta_kb)
            })}
      </button>
    {/if}
  {/if}

  {#if steady.length}
    <h3 class="mt-6 mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('Steady')}</h3>
    {@render table(steady, allSteady, false)}
    {#if steady.length > HEAD}
      <button
        type="button"
        class="mt-1 cursor-pointer text-xs text-accent hover:underline"
        onclick={() => (allSteady = !allSteady)}
      >
        {allSteady ? t('Show fewer') : t('and {count} more', { count: steady.length - HEAD })}
      </button>
    {/if}
  {/if}

  <p class="mt-6 max-w-prose text-xs leading-relaxed text-zinc-500">
    {t(
      'Growth is measured against the first time each process was seen, which is shortly after boot for anything that starts with the device. Steady includes processes that have shrunk.'
    )}
  </p>
{/if}
