<script>
  // Reboot, factory reset and firmware upgrade all put the device out of reach
  // while they run, so the whole System section shows the progress state
  // rather than each page owning its own.
  import { systemState, BUSY_MESSAGES } from '../system.svelte.js'
  import Spinner from './Spinner.svelte'
  import { t } from '../i18n.svelte.js'

  let { children } = $props()
</script>

{#if systemState.busy}
  <div class="flex flex-col items-center gap-3 rounded-base border border-zinc-200 p-10 text-center text-sm text-zinc-500">
    <Spinner class="h-6 w-6 text-zinc-400" />
    <span>{t(BUSY_MESSAGES[systemState.busy])}</span>
  </div>
{:else}
  {@render children()}
{/if}
