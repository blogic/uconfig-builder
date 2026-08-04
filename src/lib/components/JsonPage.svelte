<script>
  import { t } from '../i18n.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'

  let { preview } = $props()
</script>

<div class="page-header">
  <h2 class="page-title">{t('JSON')}</h2>
</div>
<p class="page-description">{t(PAGE_DESCRIPTIONS.json)}</p>

<pre class="overflow-x-auto rounded-base border border-zinc-200 px-5 py-4 text-xs leading-relaxed text-zinc-900">{preview}</pre>
