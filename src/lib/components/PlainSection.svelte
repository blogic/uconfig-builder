<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    children: Snippet
  }

  let { title, children }: Props = $props()
</script>

<section class="mb-5 w-full">
  <div class="section-header-static">
    <span class="section-title">{t(title)}</span>
  </div>
  <div class="w-full pt-4">{@render children()}</div>
</section>
