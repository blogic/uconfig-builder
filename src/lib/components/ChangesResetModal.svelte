<script lang="ts">
  import Button from './Button.svelte'
  import { t } from '../i18n.svelte.js'
  import type { ChangeEntry } from '../changes'

  interface Props {
    title: string
    entries: ChangeEntry[]
    onConfirm: () => void
    onCancel: () => void
  }

  let { title, entries, onConfirm, onCancel }: Props = $props()
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onclick={onCancel}>
  <div class="w-full max-w-md rounded-base border border-zinc-200 bg-surface p-5 shadow-flat-lg" onclick={(e) => e.stopPropagation()}>
    <h3 class="mb-4 text-lg font-semibold text-zinc-900">{t(title)}</h3>
    <ul class="mb-5 max-h-64 overflow-y-auto rounded-base bg-zinc-50 px-4 py-3">
      {#each entries as c}
        <li class="flex items-center gap-2 py-1 text-sm text-zinc-900">
          <span class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"></span>
          {c.label}
        </li>
      {/each}
    </ul>
    <div class="flex justify-end gap-2">
      <Button onclick={onCancel}>{t('Continue')}</Button>
      <Button variant="danger" onclick={onConfirm}>{t('Reset Changes')}</Button>
    </div>
  </div>
</div>
