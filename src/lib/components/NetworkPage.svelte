<script>
  import { deviceStore } from '../devices.svelte.js'
  import { device_name } from '../device-icons.js'
  import DeviceRow from './DeviceRow.svelte'
  import Spinner from './Spinner.svelte'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'
  import { poll_feed } from '../poll.svelte.js'
  import { t } from '../i18n.svelte.js'

  // `online` is absent rather than false on devices only ever seen via ARP,
  // so anything without it counts as offline.
  function flatten(data) {
    if (!data) return []
    const out = []
    for (const macs of Object.values(data)) {
      for (const [mac, dev] of Object.entries(macs)) out.push({ ...dev, mac: dev.mac || mac })
    }
    return out.sort((a, b) => device_name(a).localeCompare(device_name(b)))
  }

  const devices = $derived(flatten(deviceStore.data))
  const online = $derived(devices.filter((d) => d.online))
  const offline = $derived(devices.filter((d) => !d.online))

  // Stale ARP entries usually outnumber the live ones; keep them out of the way.
  let showOffline = $state(false)


  // Refresh on arrival, then poll while this page is open.
  $effect(() => poll_feed('clients'))
</script>

<div class="mb-5 flex items-start gap-3">
  <p class="page-description mb-0 flex-1">{t(PAGE_DESCRIPTIONS.clients)}</p>
  {#if deviceStore.loading}<Spinner class="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />{/if}
</div>

{#if deviceStore.error && !deviceStore.data}
  <p class="text-sm text-red-600">{deviceStore.error}</p>
{:else if deviceStore.data === null}
  <div class="flex items-center justify-center gap-3 py-10 text-sm text-zinc-500">
    <Spinner class="h-5 w-5 text-zinc-400" />
    <span>{t('Loading devices…')}</span>
  </div>
{:else if !devices.length}
  <p class="py-8 text-center text-sm text-zinc-500">{t('No devices found.')}</p>
{:else}
  <section class="mb-6">
    {#if online.length}
      <ul class="divide-y divide-zinc-200">
        {#each online as d (d.mac)}
          <DeviceRow device={d} />
        {/each}
      </ul>
    {:else}
      <p class="text-sm text-zinc-500">{t('No clients are online.')}</p>
    {/if}
  </section>

  {#if offline.length}
    <section>
      <button
        type="button"
        class="section-header w-full"
        class:is-closed={!showOffline}
        onclick={() => (showOffline = !showOffline)}
      >
        <span class="section-title text-left">{t('Offline Clients ({count})', { count: offline.length })}</span>
      </button>
      {#if showOffline}
        <ul class="divide-y divide-zinc-200">
          {#each offline as d (d.mac)}
            <DeviceRow device={d} offline />
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
{/if}
