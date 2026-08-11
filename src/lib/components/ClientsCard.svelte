<script lang="ts">
  // How many devices are on the network and how they got there. Shared for the
  // same reason as PortsCard: a bridging device counts its clients on the
  // Internet page, a routing one on its network page.
  //
  // Reads the store rather than taking a prop, so a page only has to place it;
  // polling stays with the page, since poll_feed arms one timer per call.
  import { deviceStore, clients_all } from '../devices.svelte.js'
  import { t } from '../i18n.svelte.js'

  const online = $derived(clients_all(deviceStore.data).filter((c) => c.online))
  const wireless = $derived(online.filter((c) => c.wifi).length)
</script>

<div class="rounded-base border border-zinc-200 bg-surface p-4">
  <h3 class="text-sm font-semibold text-zinc-900">{t('Clients')}</h3>
  <dl class="mt-2 space-y-1 text-sm">
    <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('Online now')}</dt><dd class="text-zinc-800">{online.length}</dd></div>
    <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('On a cable')}</dt><dd class="text-zinc-800">{online.length - wireless}</dd></div>
    <div class="flex justify-between gap-4"><dt class="text-zinc-500">{t('On Wi-Fi')}</dt><dd class="text-zinc-800">{wireless}</dd></div>
  </dl>
</div>
