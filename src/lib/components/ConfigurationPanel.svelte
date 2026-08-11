<script lang="ts">
  // The pending changes, and whatever the surrounding app can do with them.
  //
  // Applying is handed in rather than reached for: an app with a device passes
  // one, an offline editor passes none and ChangesPanel offers download and
  // save instead. This component is shared, so it must not know that a
  // websocket exists.
  import ChangesPanel from './ChangesPanel.svelte'
  import Spinner from './Spinner.svelte'
  import { t } from '../i18n.svelte.js'
  import { view } from '../view.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes: ChangeEntry[]
    connected?: boolean
    onApply?: () => Promise<void>
  }

  let { changes, connected = false, onApply }: Props = $props()

  // In menu view the Configuration section has no surrounding Card, so the
  // status states supply their own card chrome (cards view already wraps them).
  const panelClass = $derived(view.mode === 'menu' ? 'rounded-base border border-zinc-200 bg-surface px-4' : '')

  let applyState = $state<'idle' | 'applying' | 'success'>('idle')
  let applyError = $state<string | null>(null)

  async function apply() {
    if (!onApply) return
    applyState = 'applying'
    applyError = null
    try {
      await onApply()
      applyState = 'success'
    } catch (e) {
      applyError = e instanceof Error ? e.message : String(e)
      applyState = 'idle'
    }
  }

  function apply_done() {
    applyState = 'idle'
  }
</script>

{#if applyState === 'applying'}
  <div class="flex flex-col items-center gap-3 py-10 text-sm text-zinc-500 {panelClass}">
    <Spinner class="h-6 w-6 text-zinc-400" />
    <span>{t('Applying configuration to the device…')}</span>
  </div>
{:else if applyState === 'success'}
  <div class="flex flex-col items-center gap-3 py-10 text-center {panelClass}">
    <svg class="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
    <p class="text-sm font-medium text-zinc-700">{t('Configuration applied to the device.')}</p>
    <button type="button" class="btn" onclick={apply_done}>{t('Done')}</button>
  </div>
{:else}
  <ChangesPanel {changes} {connected} {applyError} onApply={apply} />
{/if}
