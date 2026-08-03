<script>
  import { t } from '../i18n.svelte.js'

  let { onclick, label = null } = $props()
</script>

<button type="button" class="btn-sm-danger inline-flex items-center gap-1.5" {onclick}>
  <i class="bi bi-trash"></i>
  {label ? t('Remove {label}', { label }) : t('Remove')}
</button>
