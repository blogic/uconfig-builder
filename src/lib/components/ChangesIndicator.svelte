<script lang="ts">
  import { changes_for } from '../changes.js'
  import { scope_reset } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    changes: ChangeEntry[]
    scope: string
  }

  let { changes, scope }: Props = $props()

  const mine = $derived(changes_for(changes, scope))
  let showModal = $state(false)

  function reset() {
    scope_reset(scope)
    showModal = false
  }
</script>

{#if mine.length}
  <button
    type="button"
    class="changes-indicator"
    title={t('Reset changes for this section')}
    onclick={() => (showModal = true)}
  >
    <i class="bi bi-exclamation-circle"></i>
    <span>{t('{count, plural, one {# change in this section} other {# changes in this section}}', { count: mine.length })}</span>
  </button>
{/if}

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={() => (showModal = false)}>
    <div class="w-full max-w-md rounded-base border border-zinc-200 bg-surface p-5 shadow-flat-lg" onclick={(e) => e.stopPropagation()}>
      <h3 class="mb-4 text-lg font-semibold text-zinc-900">{t('Pending changes in this section')}</h3>
      <ul class="mb-5 rounded-base bg-zinc-50 px-4 py-3">
        {#each mine as c}
          <li class="flex items-center gap-2 py-1 text-sm text-zinc-900">
            <span class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"></span>
            {c.label}
          </li>
        {/each}
      </ul>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" onclick={() => (showModal = false)}>{t('Continue')}</button>
        <button type="button" class="btn-sm-danger" onclick={reset}>{t('Reset Changes')}</button>
      </div>
    </div>
  </div>
{/if}
