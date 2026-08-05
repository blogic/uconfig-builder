<script lang="ts">
  import { ucoord, is_managed } from '../ucoord.svelte.js'
  import type { UcoordPeer, PeerInfo } from '../ucoord.svelte.js'
  import { uptime_format, ts_relative, bytes_format } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const venues = $derived(ucoord.venues)
  const error = $derived(ucoord.error)
  const empty = $derived(venues != null && Object.keys(venues).length === 0)

  // Connected is the steady state; the rest are transitions worth noticing.
  const STATE_TONE: Record<string, string> = {
    connected: 'bg-accent/10 text-accent',
    pending: 'bg-zinc-100 text-zinc-500'
  }

  function state_tone(state: string | undefined): string {
    return STATE_TONE[state ?? ''] ?? 'bg-amber-50 text-amber-700'
  }

  function peers_of(venue: Record<string, UcoordPeer> | undefined): [string, UcoordPeer][] {
    return Object.entries(venue ?? {})
  }

  function info_for(venue: string, peer: string): PeerInfo | null {
    return ucoord.info[`${venue}/${peer}`] ?? null
  }

  function ports_of(peer: UcoordPeer | undefined): string | null {
    const net = peer?.capabilities?.network
    if (!net) return null
    const lan = net.lan?.length ?? 0
    const wan = net.wan?.length ?? 0
    return `${lan} LAN · ${wan} WAN`
  }

  function release_of(peer: UcoordPeer | undefined): string | null {
    const r = peer?.board?.release
    if (!r) return null
    return [r.distribution, r.version].filter(Boolean).join(' ')
  }

  function mem_of(info: PeerInfo | null): string | null {
    if (!info?.memory?.total) return null
    const used = info.memory.total - info.memory.available
    return `${bytes_format(used)} / ${bytes_format(info.memory.total)}`
  }

  $effect(() => poll_feed('ucoord'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.ucoord)}</p>

{#if error && !venues}
  <div class="rounded-base border border-zinc-200 bg-surface p-4 text-sm text-red-600">{error}</div>
{:else if empty}
  <p class="rounded-base bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
    {t('No venues are configured on this device.')}
  </p>
{:else if venues}
  {#each Object.entries(venues) as [name, peers] (name)}
    <section class="mb-6">
      <div class="mb-3 flex items-baseline gap-2">
        <h2 class="text-sm font-semibold text-zinc-900">{name}</h2>
        <span class="text-xs text-zinc-500">
          {t('{count, plural, one {# peer} other {# peers}}', { count: peers_of(peers).length })}
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        {#each peers_of(peers) as [peerName, peer] (peerName)}
          {@const info = info_for(name, peerName)}
          <div class="rounded-base border border-zinc-200 bg-surface p-4 {is_managed(name, peerName) ? 'border-accent' : ''}">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-zinc-900">{peerName}</h3>
                <p class="truncate text-xs text-zinc-500">{peer?.capabilities?.model ?? peer?.board?.model ?? '—'}</p>
              </div>
              <span class="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold {state_tone(peer?.state)}">
                {peer?.state ?? '—'}
              </span>
            </div>

            {#if is_managed(name, peerName)}
              <p class="mt-2 text-[11px] font-semibold text-accent">{t('Managed from this session')}</p>
            {/if}

            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Hostname')}</dt>
                <dd class="truncate text-zinc-800">{peer?.board?.hostname ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Uptime')}</dt>
                <dd class="text-zinc-800">{uptime_format(info?.uptime)}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Memory')}</dt>
                <dd class="text-zinc-800">{mem_of(info) ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Release')}</dt>
                <dd class="truncate text-zinc-800">{release_of(peer) ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Revision')}</dt>
                <dd class="truncate font-mono text-xs text-zinc-800">{peer?.board?.release?.revision ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Kernel')}</dt>
                <dd class="font-mono text-xs text-zinc-800">{peer?.board?.kernel ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('Ports')}</dt>
                <dd class="text-zinc-800">{ports_of(peer) ?? '—'}</dd>
              </div>
              <!-- The daemon only rewrites the timestamp when a peer changes
                   state, so this is not a last-seen heartbeat. -->
              <div class="flex justify-between gap-4">
                <dt class="text-zinc-500">{t('State changed')}</dt>
                <dd class="text-zinc-800">{ts_relative(peer?.ts)}</dd>
              </div>
            </dl>
          </div>
        {/each}
      </div>
    </section>
  {/each}
{/if}
