<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    // Colour only. Every variant shares one size, so a button cannot drift out
    // of step with the rest of the app by picking its own padding.
    variant?: 'default' | 'primary' | 'danger'
    icon?: string | null
    type?: 'button' | 'submit'
    disabled?: boolean
    // Opt-in: only for a button that is the sole action in a narrow card.
    full?: boolean
    title?: string | null
    onclick?: (e: MouseEvent) => void
    children: Snippet
  }

  let {
    variant = 'default',
    icon = null,
    type = 'button',
    disabled = false,
    full = false,
    title = null,
    onclick
  , children }: Props = $props()

  const TONE = {
    default: 'border-zinc-300 bg-surface text-zinc-700 hover:border-accent hover:text-accent',
    primary: 'border-accent bg-accent text-accent-ink hover:brightness-95',
    danger: 'border-red-500 bg-red-500 text-white hover:brightness-95'
  }
</script>

<button
  {type}
  {disabled}
  {title}
  {onclick}
  class="inline-flex cursor-pointer items-center gap-1.5 rounded-base border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {TONE[
    variant
  ]} {full ? 'w-full justify-center' : ''}"
>
  {#if icon}<i class="bi {icon}"></i>{/if}
  {@render children()}
</button>
