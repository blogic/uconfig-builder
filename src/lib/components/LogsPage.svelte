<script lang="ts">
  // The device's own logs, verbatim. Two tabs rather than two pages: they are
  // the same shape from two different daemons, and reading one usually means
  // glancing at the other.
  //
  // The text is not translated. It comes from the device, and a log line that
  // has been reworded is no longer evidence.
  import { syslog, dmesg, log_ordered, log_severity } from '../diagnostics.svelte.js'
  import type { LogEntry } from '../diagnostics.svelte.js'
  import LogPane from './LogPane.svelte'
  import { sysinfo } from '../sysinfo.svelte.js'
  import { clock_format, day_label } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const TABS = [
    { key: 'system', label: 'System' },
    { key: 'kernel', label: 'Kernel' }
  ]
  let selected = $state('system')

  const feed = $derived(selected === 'kernel' ? dmesg : syslog)

  // The device's clock, not the browser's: these timestamps and the device's
  // idea of now come from the same place.
  const now = $derived(sysinfo.data?.localtime ?? Math.floor(Date.now() / 1000))

  // Both logs are stamped in milliseconds; the shared formatters take seconds.
  const secs = (ms: number | null | undefined) => (ms == null ? null : Math.floor(ms / 1000))

  // `day_label` returns a plain label so it stays free of the i18n runtime; the
  // two fixed ones are translated here, where the extractor can see them.
  function day_of(ts: number): string {
    const d = day_label(ts, now)
    if (d === 'Today') return t('Today')
    if (d === 'Yesterday') return t('Yesterday')
    return d
  }

  // The day heading is carried on the row that opens it, so the template does
  // not have to reach backwards and relabel every entry twice.
  const shown = $derived.by(() => {
    let last = ''
    return log_ordered(feed.data).map((e) => {
      const s = secs(e.time)
      const day = s == null ? '' : day_of(s)
      const opens = day !== '' && day !== last
      if (day) last = day
      return { e, s, day: opens ? day : null }
    })
  })

  // Every severity gets its own colour, so the shape of a bad stretch is
  // visible without reading it. Ordered by how much it matters: the three above
  // err are rare enough that they should look different from an ordinary error.
  const TONES = [
    'text-red-700 font-bold', // emerg
    'text-red-700 font-bold', // alert
    'text-red-700 font-bold', // crit
    'text-red-600', // err
    'text-amber-600', // warning
    'text-sky-600', // notice
    'text-emerald-600', // info
    'text-zinc-400' // debug
  ]

  function tone(e: LogEntry): string {
    if (e.priority == null) return 'text-zinc-400'
    return TONES[e.priority & 7] ?? 'text-zinc-400'
  }

  // Only the open tab polls. Switching tabs re-runs the effect, which tears the
  // previous interval down.
  $effect(() => poll_feed(selected === 'kernel' ? 'dmesg' : 'syslog'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.logs)}</p>

<div class="tab-row">
  {#each TABS as tab (tab.key)}
    <button
      type="button"
      class="tab-button {selected === tab.key ? 'tab-button-active' : ''}"
      onclick={() => (selected = tab.key)}
    >
      {t(tab.label)}
    </button>
  {/each}
</div>

{#if feed.error && !feed.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{feed.error}</div>
{:else if !shown.length}
  <div class="rounded-base bg-zinc-50 px-5 py-10 text-center">
    <p class="text-sm font-semibold text-zinc-700">
      {feed.data ? t('Nothing logged yet') : t('Loading…')}
    </p>
    {#if feed.data}
      <p class="mt-1 text-sm text-zinc-500">
        {selected === 'kernel'
          ? t('The kernel log covers this boot only.')
          : t('The log is kept in memory and starts fresh when the device restarts.')}
      </p>
    {/if}
  </div>
{:else}
  <LogPane revision={selected + '/' + shown.length}>
    {#snippet children()}
      {#each shown as { e, s, day }, i ((e.id ?? e.time ?? 0) + '/' + i)}
        {#if day}
          <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 first:mt-0">
            {day}
          </p>
        {/if}
        <div class="flex items-baseline gap-3 py-0.5 text-sm">
          <span class="w-16 flex-shrink-0 tabular-nums text-zinc-500">
            {s == null ? '—' : clock_format(s)}
          </span>
          <span class="w-14 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide {tone(e)}">
            {log_severity(e.priority) ?? ''}
          </span>
          <span class="min-w-0 flex-1 break-words font-mono text-xs text-zinc-700">{e.msg}</span>
        </div>
      {/each}
    {/snippet}
  </LogPane>
{/if}
