<script>
  // The standalone editor has no section tabs, so its top bar has room for the
  // page title and it is hoisted there (see TopBar's `railed` mode). The live
  // device UI keeps the title in the page body, under the accent rule.
  import { page_set, page_clear } from '../page.svelte.js'
  import { hoisted } from '../page.svelte.js'

  let { title, actions = null } = $props()

  $effect(() => {
    if (!hoisted.on) return
    page_set(title, actions)
    return page_clear
  })
</script>

{#if !hoisted.on}
  <div class="mb-5 flex items-center gap-3 border-b-2 border-accent pb-2.5">
    <h2 class="flex-1 text-2xl font-semibold text-zinc-900">{title}</h2>
    {#if actions}{@render actions()}{/if}
  </div>
{/if}
