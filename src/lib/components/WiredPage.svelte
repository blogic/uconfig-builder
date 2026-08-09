<script lang="ts">
  // The wired side: what this device calls itself on the local network, and
  // which sockets have anything in them.
  import { network, ports, local, sorted_ports } from '../netstate.svelte.js'
  import { deviceStore, clients_all } from '../devices.svelte.js'
  import { bytes_format } from '../device-icons.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const nets = $derived(local(network.data))
  const switchPorts = $derived(sorted_ports(ports.data, false))
  const linked = $derived(switchPorts.filter(([, p]) => p.carrier).length)

  // A client is on a cable when nothing reported it over the air.
  const clients = $derived(clients_all(deviceStore.data))
  const online = $derived(clients.filter((c) => c.online))
  const wireless = $derived(online.filter((c) => c.wifi).length)

  $effect(() => poll_feed('network'))
  $effect(() => poll_feed('ports'))
  $effect(() => poll_feed('clients'))
</script>

<p class="page-description">{t(PAGE_DESCRIPTIONS.wired)}</p>

{#if network.error && !network.data}
  <div class="rounded-base border border-zinc-200 p-4 text-sm text-red-600">{network.error}</div>
{:else}
  <div class="grid gap-4 sm:grid-cols-2">
    {#each nets as [name, iface] (name)}
      <div class="rounded-base border border-zinc-200 bg-surface p-4">
        <div class="flex items-baseline gap-2">
          <h3 class="text-sm font-semibold text-zinc-900">{t('This device')}</h3>
          <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">{name}</span>
        </div>
        <dl class="mt-2 space-y-1 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Address')}</dt><dd class="truncate text-zinc-800">{iface.ipv4?.address ?? '—'}</dd></div>
          {#each iface.ipv6?.assigned ?? [] as addr, i (addr)}
            <div class="flex justify-between gap-4">
              <dt class="text-zinc-500">{i === 0 ? t('IPv6') : t('Also reachable at')}</dt>
              <dd class="truncate font-mono text-xs text-zinc-800">{addr}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/each}

    <div class="rounded-base border border-zinc-200 bg-surface p-4">
      <h3 class="text-sm font-semibold text-zinc-900">{t('Clients')}</h3>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Online now')}</dt><dd class="text-zinc-800">{online.length}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('On a cable')}</dt><dd class="text-zinc-800">{online.length - wireless}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('On Wi-Fi')}</dt><dd class="text-zinc-800">{wireless}</dd></div>
      </dl>
    </div>
  </div>

  {#if switchPorts.length}
    <div class="mt-4 rounded-base border border-zinc-200 bg-surface p-4">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-semibold text-zinc-900">{t('Sockets')}</h3>
        <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
          {t('{linked} of {total} in use', { linked, total: switchPorts.length })}
        </span>
      </div>
      <ul class="mt-2 divide-y divide-zinc-100">
        {#each switchPorts as [name, port] (name)}
          <li class="flex items-center gap-3 py-2 text-sm {port.carrier ? 'text-zinc-800' : 'text-zinc-400'}">
            <span class="w-14 flex-shrink-0 font-semibold {port.carrier ? '' : 'text-zinc-500'}">{name}</span>
            <span>{port.carrier ? t('{speed} Mbit/s', { speed: port.speed ?? '—' }) : t('No cable')}</span>
            <span class="ml-auto tabular-nums text-zinc-500">
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
  {/if}
{/if}
