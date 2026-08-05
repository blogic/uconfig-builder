<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import type { Radio } from '../types/uconfig'

  interface Props {
    // The owner of `obj` performs the write; a child mutating a prop it does
    // not own is what Svelte reports as ownership_invalid_mutation.
    onset: (key: string, value: unknown) => void
    obj: Record<string, unknown>
    describe?: string | null
  }

  let { obj, onset, describe = null }: Props = $props()

  // Reads go through a narrowed view; the prop itself stays the caller's
  // object so mutations keep Svelte's ownership link.
  const o = $derived(obj as Radio)

  const fid = $props.id()
  const desc = $derived(t(describe ?? ''))
  const MAX = 30
  const value = $derived(o['tx-power'] ?? MAX)
  const pct = $derived(Math.round((value / MAX) * 100))

  $effect(() => {
    if (obj['tx-power'] == null) onset('tx-power', MAX)
  })

  function onInput(e: Event) {
    onset('tx-power', Number((e.currentTarget as HTMLInputElement).value))
  }
</script>

<div class="flex flex-col gap-1">
  <label for={fid} class="text-xs font-medium text-zinc-700">{t('TX Power')}</label>
  <input
    id={fid}
    type="range"
    min="0"
    max={MAX}
    step="1"
    value={value}
    oninput={onInput}
    class="w-full accent-accent"
  />
  <p class="text-center text-[11px] text-zinc-500">{pct}% ({value} dBm)</p>
  {#if desc}<p class="text-[11px] leading-snug text-zinc-500">{desc}</p>{/if}
</div>
