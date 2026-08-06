<script lang="ts">
  import { changes_for } from '../changes.js'
  import { scope_reset } from '../store.svelte.js'
  import { t } from '../i18n.svelte.js'
  import ChangesResetModal from './ChangesResetModal.svelte'
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
  <ChangesResetModal
    title="Pending changes in this section"
    entries={mine}
    onConfirm={reset}
    onCancel={() => (showModal = false)}
  />
{/if}
