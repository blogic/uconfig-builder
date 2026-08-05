<script lang="ts">
  import PageHeader from './PageHeader.svelte'
  import { t } from '../i18n.svelte.js'
  import { PAGE_DESCRIPTIONS } from '../descriptions.js'

  interface Props {
    preview: string
  }

  let { preview }: Props = $props()
</script>

<PageHeader title={t('JSON')} />
<p class="page-description">{t(PAGE_DESCRIPTIONS.json)}</p>

<pre class="overflow-x-auto rounded-base border border-zinc-200 px-5 py-4 text-xs leading-relaxed text-zinc-900">{preview}</pre>
