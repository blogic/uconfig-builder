<script lang="ts">
  // The device's own account of the last few hours. Everything here is
  // otherwise invisible: a client that keeps dropping, a cable that is not
  // seated, someone at the door with last year's passphrase.
  import { events, events_recent, event_group } from '../diagnostics.svelte.js'
  import type { EventEntry } from '../diagnostics.svelte.js'
  import { deviceStore, clients_all } from '../devices.svelte.js'
  import { sysinfo } from '../sysinfo.svelte.js'
  import {
    bytes_format,
    uptime_format,
    clock_format,
    day_label,
    device_name
  } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'clients', label: 'Clients' },
    { key: 'wireless', label: 'Wi-Fi' },
    { key: 'device', label: 'Device' }
  ]
  let selected = $state('all')

  const TAGS: Record<string, string> = {
    client: 'client',
    dhcp: 'dhcp',
    wifi: 'wi-fi',
    carrier: 'link',
    ssh: 'ssh'
  }

  // The log records MACs and people read names. `devices` is the only thing that
  // maps one to the other, through the same fallback chain the Clients page
  // uses, so a device is called the same thing on both. One that has never been
  // seen keeps its MAC, which is the honest answer rather than a gap.
  const names = $derived.by(() => {
    const out: Record<string, string> = {}
    for (const d of clients_all(deviceStore.data)) out[d.mac.toUpperCase()] = device_name(d)
    return out
  })

  function who(mac: unknown): string {
    const s = String(mac ?? '')
    return names[s.toUpperCase()] ?? s
  }

  // The device's clock, not the browser's: both these timestamps and the
  // device's idea of now come from the same place.
  const now = $derived(sysinfo.data?.localtime ?? Math.floor(Date.now() / 1000))

  // `day_label` returns a plain label so it stays free of the i18n runtime; the
  // two fixed ones are translated here, where the extractor can see them. A
  // formatted date needs no key -- Intl has already localised it.
  function day_of(ts: number): string {
    const d = day_label(ts, now)
    if (d === 'Today') return t('Today')
    if (d === 'Yesterday') return t('Yesterday')
    return d
  }

  // The day heading is carried on the row that opens it, so the template does
  // not have to reach backwards and relabel every entry twice.
  const shown = $derived.by(() => {
    const list = events_recent(events.data).filter(
      (e) => selected === 'all' || event_group(e) === selected
    )
    let last = ''
    return list.map((e) => {
      const day = day_of(e.time)
      const opens = day !== last
      last = day
      return { e, day: opens ? day : null }
    })
  })

  type Part = { t: string; b?: boolean }

  function band_name(band: unknown, freq?: unknown): string {
    if (band === '5G' || (typeof freq === 'number' && freq >= 5000)) return t('5 GHz')
    if (band === '6G') return t('6 GHz')
    return t('2.4 GHz')
  }

  // Each event is one whole sentence with the emphasised value substituted in,
  // rather than fragments concatenated around a bold span. Translators get a
  // real sentence and can put the placeholder wherever their grammar wants it;
  // the marker travels with the value, so the bold follows.
  const MARK = '\u0001'
  const em = (v: unknown) => MARK + String(v ?? '—') + MARK

  function split(s: string): Part[] {
    return s.split(MARK).map((t, i) => ({ t, b: i % 2 === 1 }))
  }

  // Anything unrecognised still renders: the vocabulary is open, and a dropped
  // event is worse than an ugly one.
  function sentence(e: EventEntry): string {
    const k = `${e.object}/${e.verb}`
    if (k === 'client/join')
      return t('{name} joined {ssid} on {band}, channel {channel}', {
        name: em(who(e.mac)),
        ssid: String(e.ssid ?? '—'),
        band: band_name(e.band),
        channel: String(e.channel ?? '—')
      })
    if (k === 'client/leave')
      return t('{name} left after {time}, {bytes} down', {
        name: em(who(e.mac)),
        time: uptime_format(Number(e.connected_time)),
        bytes: bytes_format(Number(e.rx_bytes ?? 0))
      })
    if (k === 'client/key-mismatch')
      return t('{name} could not join {ssid} — wrong passphrase', {
        name: em(who(e.mac)),
        ssid: String(e.ssid ?? '—')
      })
    if (e.object === 'dhcp')
      return t('Handed {ip} to {name}', { ip: em(e.ip), name: who(e.mac) })
    if (k === 'wifi/start')
      return t('{ssid} started on {band}, channel {channel}', {
        ssid: String(e.ssid ?? '—'),
        band: band_name(e.band),
        channel: String(e.channel ?? '—')
      })
    if (k === 'wifi/stop')
      return t('{ssid} stopped on {band}, channel {channel}', {
        ssid: String(e.ssid ?? '—'),
        band: band_name(e.band),
        channel: String(e.channel ?? '—')
      })
    if (k === 'wifi/channel-switch')
      return e.bandwidth
        ? t('{band} moved to channel {channel}, {width} MHz wide', {
            band: band_name(e.band, e.freq),
            channel: em(e.channel),
            width: String(e.bandwidth)
          })
        : t('{band} moved to channel {channel}', {
            band: band_name(e.band, e.freq),
            channel: em(e.channel)
          })
    if (e.object === 'carrier')
      return e.verb === 'up'
        ? t('Cable plugged into {name}', { name: em(e.name) })
        : t('Cable pulled from {name}', { name: em(e.name) })
    if (e.object === 'ssh') return String(e.msg ?? '')

    const rest = Object.entries(e)
      .filter(([f]) => f !== 'object' && f !== 'verb' && f !== 'time')
      .map(([f, v]) => `${f}=${v}`)
      .join(' ')
    return `${em(e.object + ' ' + e.verb)}${rest ? ' ' + rest : ''}`
  }

  $effect(() => poll_feed('events'))
  $effect(() => poll_feed('clients'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.events)}</p>

{#if events.error && !events.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{events.error}</div>
{:else}
  <div class="tab-row">
    {#each FILTERS as f (f.key)}
      <button
        type="button"
        class="tab-button {selected === f.key ? 'tab-button-active' : ''}"
        onclick={() => (selected = f.key)}
      >
        {t(f.label)}
      </button>
    {/each}
  </div>

  {#if !shown.length}
    <div class="rounded-base bg-zinc-50 px-5 py-10 text-center">
      <p class="text-sm font-semibold text-zinc-700">
        {events.data ? t('Nothing recorded yet') : t('Loading…')}
      </p>
      {#if events.data}
        <p class="mt-1 text-sm text-zinc-500">
          {selected === 'all'
            ? t('The log is kept in memory and starts fresh when the device restarts.')
            : t('Nothing under this heading.')}
        </p>
      {/if}
    </div>
  {:else}
    {#each shown as { e, day }, i (e.time + '/' + e.object + '/' + i)}
      {#if day}
        <p class="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 first:mt-0">
          {day}
        </p>
      {/if}
      <div class="flex items-baseline gap-3 border-t border-zinc-100 py-1.5 text-sm first:border-t-0">
        <span class="w-16 flex-shrink-0 tabular-nums text-zinc-500">{clock_format(e.time)}</span>
        <span class="w-12 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {TAGS[e.object] ?? e.object}
        </span>
        <span class="min-w-0 text-zinc-700">
          {#each split(sentence(e)) as p, n (n)}{#if p.b}<b class="font-semibold text-zinc-900"
              >{p.t}</b
            >{:else}{p.t}{/if}{/each}
        </span>
      </div>
    {/each}
  {/if}
{/if}
