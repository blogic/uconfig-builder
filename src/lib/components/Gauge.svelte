<script lang="ts">
  import { bits_format, LINK_BITS } from '../traffic.svelte.js'
  import { t } from '../i18n.svelte.js'

  interface Props {
    value?: number
    label: string
    muted?: boolean
  }

  let { value = 0, label, muted = false }: Props = $props()

  const R = 52
  const CX = 60
  const CY = 60
  const START = 135 // degrees, sweeping clockwise
  const SWEEP = 270

  // Full scale is the link rate, so a linear arc would leave everyday traffic
  // pinned at zero. Map decades instead: 1k, 10k, 100k, 1M ... up to the link.
  const DECADES = Math.log10(LINK_BITS / 1e3)

  const frac = $derived(fraction(value))
  const fmt = $derived(bits_format(value))

  function fraction(bps: number): number {
    if (!bps || bps < 1e3) return 0
    return Math.min(1, Math.log10(bps / 1e3) / DECADES)
  }

  function arc(from: number, to: number): string {
    const a0 = ((START + from * SWEEP) * Math.PI) / 180
    const a1 = ((START + to * SWEEP) * Math.PI) / 180
    const x0 = CX + R * Math.cos(a0)
    const y0 = CY + R * Math.sin(a0)
    const x1 = CX + R * Math.cos(a1)
    const y1 = CY + R * Math.sin(a1)
    const large = (to - from) * SWEEP > 180 ? 1 : 0
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`
  }
</script>

<div class="flex flex-col items-center">
  <svg viewBox="0 0 120 120" class="h-32 w-32" role="img" aria-label={t(label)}>
    <path d={arc(0, 1)} fill="none" stroke="currentColor" class="text-zinc-200" stroke-width="9" stroke-linecap="round" />
    {#if frac > 0}
      <path
        d={arc(0, frac)}
        fill="none"
        stroke="currentColor"
        class={muted ? 'text-zinc-400' : 'text-accent'}
        stroke-width="9"
        stroke-linecap="round"
      />
    {/if}
    <text x={CX} y={CY - 2} text-anchor="middle" class="fill-zinc-900 text-[19px] font-semibold">{fmt.value}</text>
    <text x={CX} y={CY + 14} text-anchor="middle" class="fill-zinc-500 text-[9px]">{fmt.unit}</text>
  </svg>
  <p class="mt-1 text-sm font-medium text-zinc-700">{t(label)}</p>
</div>
