<script>
  import { untrack } from 'svelte'
  import { accordion_get } from '../accordion.svelte.js'
  import { t } from '../i18n.svelte.js'

  let { title, open = false, children, actions = null } = $props()

  const acc = accordion_get()
  const id = $props.id()
  let localOpen = $state(untrack(() => open))
  const isOpen = $derived(acc ? acc.isOpen(id) : localOpen)

  $effect(() => {
    untrack(() => acc?.register(id))
  })

  function toggle(e) {
    e.preventDefault()
    if (acc) acc.toggle(id)
    else localOpen = !localOpen
  }
</script>

<details class="w-full {isOpen ? 'mb-5' : 'mb-3'}" open={isOpen}>
  <summary class="section-header {isOpen ? '' : 'is-closed'}" onclick={toggle}>
    <span class="section-title">{t(title)}</span>
    {#if actions}
      <span role="presentation" onclick={(e) => e.stopPropagation()}>{@render actions()}</span>
    {/if}
  </summary>
  {#if isOpen}
    <div class="w-full pt-4">{@render children()}</div>
  {/if}
</details>
