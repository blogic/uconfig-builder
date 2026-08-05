<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Props {
    onclick: (e: MouseEvent) => void
    label?: string | null
  }

  let { onclick, label = null }: Props = $props()
</script>

<button type="button" class="btn-add" {onclick}>{label ? t('Add {label}', { label }) : t('Add')}</button>
