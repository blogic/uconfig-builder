<script>
  import { t } from '../i18n.svelte.js'

  let { onclick, label = null } = $props()
</script>

<button type="button" class="btn-add" {onclick}>{label ? t('Add {label}', { label }) : t('Add')}</button>
