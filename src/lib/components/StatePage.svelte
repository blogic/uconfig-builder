<script lang="ts">
  import { capabilities } from '../capabilities.svelte.js'
  import { sysinfo } from '../sysinfo.svelte.js'
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

  // ubus loadavg is fixed-point, scaled by 1<<16.
  const load = $derived((info?.load ?? []).map((v) => (v / 65536).toFixed(2)))


  // Refresh on arrival, then poll while this page is open.
  $effect(() => poll_feed('state'))
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
    <h3 class="text-sm font-semibold text-zinc-900">{t('CPU load')}</h3>
    <dl class="mt-2 space-y-1 text-sm">
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('1 min')}</dt><dd class="font-mono text-zinc-800">{load[0] ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('5 min')}</dt><dd class="font-mono text-zinc-800">{load[1] ?? '—'}</dd></div>
      <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('15 min')}</dt><dd class="font-mono text-zinc-800">{load[2] ?? '—'}</dd></div>
    </dl>
  </div>
</div>
