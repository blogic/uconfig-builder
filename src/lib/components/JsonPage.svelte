<script>
  import { t } from '../i18n.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'

  import { view } from '../view.svelte.js'

  let { preview } = $props()

  // In cards view the surrounding Card supplies the heading.
  const standalone = $derived(view.mode === 'menu')
</script>

{#if standalone}
  <div class="page-header">
    <h2 class="page-title">{t('JSON')}</h2>
  </div>
  <p class="page-description">{t(PAGE_DESCRIPTIONS.json)}</p>
{/if}

<pre class="overflow-x-auto rounded-base border border-zinc-200 px-5 py-4 text-xs leading-relaxed text-zinc-900">{preview}</pre>
