<script>
  // The standalone editor has no section tabs, so its top bar has room for the
  // page title and it is hoisted there (see TopBar's `railed` mode).
  //
  // The live device UI names the current page in the sidebar, so repeating it
  // in the body is redundant and the title is dropped. Actions are not: the
  // pending-changes badge lives there and has nowhere else to go.
  import { page_set, page_clear } from '../page.svelte.js'
  import { hoisted } from '../page.svelte.js'

  let { title, actions = null } = $props()

  $effect(() => {
    if (!hoisted.on) return
    page_set(title, actions)
    return page_clear
  })
</script>

{#if !hoisted.on && actions}
  <!-- The changes badge renders nothing when a section is unedited. Svelte
       still leaves comment anchors behind, so :empty never matches; keying the
       layout off an actual child element is what keeps the row from leaving a
       gap above the page body. -->
  <div class="hidden items-center justify-end gap-3 pb-5 has-[>*]:flex">{@render actions()}</div>
{/if}
