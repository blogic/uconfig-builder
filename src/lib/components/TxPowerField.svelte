<script lang="ts">
  import { t } from '../i18n.svelte.js'
  import type { Radio } from '../types/uconfig'

  interface Props {
    obj: Radio
    describe?: string | null
  }

  let { obj, describe = null }: Props = $props()

  const fid = $props.id()
  const desc = $derived(t(describe ?? ''))
  const MAX = 30
  const value = $derived(obj['tx-power'] ?? MAX)
  const pct = $derived(Math.round((value / MAX) * 100))

  $effect(() => {
    if (obj['tx-power'] == null) obj['tx-power'] = MAX
  })

  function onInput(e: Event) {
    obj['tx-power'] = Number((e.currentTarget as HTMLInputElement).value)
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
