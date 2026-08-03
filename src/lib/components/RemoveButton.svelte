<script>
  import { t } from '../i18n.svelte.js'

  // Row-level removal is a bare trash icon; `filled` gives the page-level
  // destructive button (e.g. Remove Interface) its red fill and text.
  let { onclick, label = null, filled = false } = $props()

  const text = $derived(label ? t('Remove {label}', { label }) : t('Remove'))
</script>

{#if filled}
  <button type="button" class="btn-sm-danger inline-flex items-center gap-1.5" {onclick}>
    <i class="bi bi-trash"></i>
    {text}
  </button>
{:else}
  <button type="button" class="btn-remove-item" aria-label={text} title={text} {onclick}>
    <i class="bi bi-trash"></i>
  </button>
{/if}
