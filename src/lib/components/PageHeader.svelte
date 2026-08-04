<script>
  // Declares the page title (and any trailing controls) next to the page's own
  // content, but renders nothing: TopBar draws them. Kept as a component rather
  // than a call so the title tracks reactive values without each page wiring up
  // its own effect.
  import { page_set, page_clear } from '../page.svelte.js'

  let { title, actions = null } = $props()

  $effect(() => {
    page_set(title, actions)
    return page_clear
  })
</script>
