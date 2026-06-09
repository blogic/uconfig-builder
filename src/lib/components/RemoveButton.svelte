<script>
  import { t } from '../i18n.svelte.js'

  let { onclick } = $props()
</script>

<button type="button" class="btn-sm-danger" {onclick}>{t('- remove')}</button>
