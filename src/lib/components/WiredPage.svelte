<script lang="ts">
  // The wired side: what this device calls itself on the local network, and
  // which ports have anything in them.
  import { network, ports, local, sorted_ports } from '../netstate.svelte.js'
  import PortsCard from './PortsCard.svelte'
  import ClientsCard from './ClientsCard.svelte'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  const nets = $derived(local(network.data))
  const switchPorts = $derived(sorted_ports(ports.data, false))

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

    <ClientsCard />
  </div>

  {#if switchPorts.length}
    <div class="mt-4">
      <PortsCard entries={switchPorts} />
    </div>
  {/if}
{/if}
