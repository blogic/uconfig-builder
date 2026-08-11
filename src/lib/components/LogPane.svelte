<script lang="ts">
  // A log window: fixed height, scrolls itself, pinned to the newest entry at
  // the bottom. Shared by the Logs and Events pages so the page itself never
  // grows to the length of a ring buffer.
  //
  // A div rather than a textarea, which is what this looks like: a textarea can
  // only hold plain text, and these lines carry severity colour and emphasis.
  import type { Snippet } from 'svelte'

  interface Props {
    // Read by the effect below, so passing something that changes with the
    // content is what re-pins the view after a refresh.
    revision: unknown
    children: Snippet
  }

  let { revision, children }: Props = $props()

  let box = $state<HTMLDivElement | null>(null)

  // Follow the tail only while the reader is already at it. Scrolling up to
  // read something means the next poll must not yank the view back down.
  let following = $state(true)

  // Enough slack that a part-scrolled line still counts as being at the bottom.
  const SLACK_PX = 24

  function scroll_check() {
    if (!box) return
    following = box.scrollHeight - box.scrollTop - box.clientHeight <= SLACK_PX
  }

  $effect(() => {
    revision
    if (box && following) box.scrollTop = box.scrollHeight
  })
</script>

<!-- A scrollable region has to be focusable or it cannot be scrolled from the
     keyboard at all. The rule is aimed at static elements, which this is not:
     role="log" already carries an implicit aria-live of polite. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={box}
  onscroll={scroll_check}
  role="log"
  tabindex="0"
  class="h-[calc(100vh-16rem)] min-h-64 overflow-y-auto rounded-base border border-zinc-200 bg-surface px-3 py-2"
>
  {@render children()}
</div>
