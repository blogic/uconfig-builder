<script>
  import Spinner from './Spinner.svelte'
  import { t } from '../i18n.svelte.js'

  let { done = 0, total = 1, label = null } = $props()

  const pct = $derived(total ? Math.round((done / total) * 100) : 0)
</script>

<div class="flex flex-1 items-center justify-center p-4">
  <div class="w-full max-w-xs text-center">
    <Spinner class="mx-auto h-7 w-7 text-zinc-400" />
    <p class="mt-4 text-sm font-medium text-zinc-900">{t('Loading data…')}</p>
    <p class="mt-1 h-4 text-xs text-zinc-500">{label ? t(label) : ''}</p>
    <div class="mt-4 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
      <div class="h-full rounded-full bg-accent transition-all duration-300" style="width: {pct}%"></div>
    </div>
  </div>
</div>
