<script lang="ts">
  // What each radio settled on, and how busy the air around it is.
  //
  // Airtime is the number worth having: a band two thirds busy explains a slow
  // network that every other page reports as healthy.
  import UsageGauge from './UsageGauge.svelte'
  import { radios } from '../netstate.svelte.js'
  import { deviceStore } from '../devices.svelte.js'
  import { title_for } from '../labels.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  // `radios` keys on the band as the wireless config spells it, lowercase; the
  // schema and the client list use 2G and 5G. Fold case to join the two.
  const bands = $derived(Object.entries(radios.data ?? {}))

  const clients = $derived(
    Object.values(deviceStore.data ?? {}).flatMap((macs) => Object.values(macs))
  )

  function on_band(band: string): number {
    return clients.filter((c) => c.online && c.wifi?.band?.toLowerCase() === band.toLowerCase()).length
  }

  // The marketing name is what the label on the box says; the config field is
  // the 802.11 letter.
  const MODES: Record<string, string> = {
    EHT: 'Wi-Fi 7',
    HE: 'Wi-Fi 6',
    VHT: 'Wi-Fi 5',
    HT: 'Wi-Fi 4'
  }

  // "0" is what the config writes for automatic, so a radio asked to choose
  // reports the channel it picked against a request for none.
  function channel_line(r: { channel?: string; active_channel?: string }): string {
    const active = r.active_channel ?? r.channel ?? '—'
    if (!r.channel || r.channel === '0' || r.channel === 'auto') {
      return t('{channel} · chosen automatically', { channel: active })
    }
    return t('{channel} · set in the config', { channel: active })
  }

  function airtime_note(pct: number): string {
    if (pct >= 75) return t('Busy. Other networks nearby are likely on this channel too.')
    if (pct >= 40) return t('Moderate. Fine for browsing, tight for several video calls.')
    return t('Quiet. Room for more clients or a wider channel.')
  }

  $effect(() => poll_feed('radios'))
  $effect(() => poll_feed('clients'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.airtime)}</p>

{#if radios.error && !radios.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{radios.error}</div>
{:else if !bands.length}
  <p class="py-8 text-center text-sm text-zinc-500">{t('This device reports no radios.')}</p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2">
    {#each bands as [band, radio] (band)}
      <div class="rounded-base border border-zinc-200 bg-surface p-4">
        <div class="flex flex-wrap items-baseline gap-2">
          <h3 class="text-sm font-semibold text-zinc-900">{title_for(band.toUpperCase())}</h3>
          {#if radio.mode && MODES[radio.mode]}
            <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              {MODES[radio.mode]}
            </span>
          {/if}
          <span class="rounded-full bg-nav-active px-2 py-0.5 text-[10px] font-semibold text-accent-dark">
            {t('{count, plural, one {# client} other {# clients}}', { count: on_band(band) })}
          </span>
        </div>

        <dl class="mt-2 space-y-1 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Channel')}</dt><dd class="truncate text-zinc-800">{channel_line(radio)}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Width')}</dt><dd class="text-zinc-800">{radio.bandwidth ? t('{width} MHz', { width: radio.bandwidth }) : '—'}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Frequency')}</dt><dd class="text-zinc-800">{radio.freq ? t('{freq} MHz', { freq: radio.freq }) : '—'}</dd></div>
        </dl>

        {#if radio.utilization != null}
          <div class="mt-3 flex items-center gap-4">
            <UsageGauge used={radio.utilization} total={100} label="Airtime in use" />
            <p class="text-xs leading-snug text-zinc-500">{airtime_note(radio.utilization)}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
