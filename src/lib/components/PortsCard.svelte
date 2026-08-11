<script lang="ts">
  // The sockets on the back of the device. Shared, because a bridging device
  // reports them on the Internet page and a routing one on its own network
  // page, and a port reads the same either way.
  import type { PortState } from '../netstate.svelte.js'
  import { bytes_format } from '../device-icons.js'
  import { t } from '../i18n.svelte.js'

  interface Props {
    entries: [string, PortState][]
    // Left to the caller: a lone WAN port is a link state, a switch is a count.
    badge?: string | null
    badgeActive?: boolean
    wide?: boolean
  }

  let { entries, badge = null, badgeActive = false, wide = false }: Props = $props()

  const linked = $derived(entries.filter(([, p]) => p.carrier).length)
  const label = $derived(
    badge ?? t('{linked} of {total} in use', { linked, total: entries.length })
  )
</script>

<div class="rounded-base border border-zinc-200 bg-surface p-4 {wide ? 'sm:col-span-2' : ''}">
  <div class="flex items-baseline gap-2">
    <h3 class="text-sm font-semibold text-zinc-900">{t('Ports')}</h3>
    <span
      class="rounded-full px-2 py-0.5 text-[11px] font-semibold {badgeActive
        ? 'bg-accent/10 text-accent'
        : 'bg-zinc-100 text-zinc-500'}"
    >
      {label}
    </span>
  </div>
  <ul class="mt-2 divide-y divide-zinc-100">
    {#each entries as [name, port] (name)}
      <li class="flex items-center gap-3 py-2 text-sm {port.carrier ? 'text-zinc-800' : 'text-zinc-400'}">
        <span class="w-14 flex-shrink-0 font-semibold {port.carrier ? '' : 'text-zinc-500'}">{name}</span>
        <span class="min-w-0 truncate">
          {port.carrier ? t('{speed} Mbit/s', { speed: port.speed ?? '—' }) : t('No cable')}
        </span>
        <span class="ml-auto flex-shrink-0 whitespace-nowrap tabular-nums text-zinc-500">
          {#if port.carrier}
            ↓ {bytes_format(port.rx_bytes ?? 0)} &nbsp; ↑ {bytes_format(port.tx_bytes ?? 0)}
          {:else}
            —
          {/if}
        </span>
      </li>
    {/each}
  </ul>
</div>
