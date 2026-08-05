<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Props {
    used?: number
    total?: number
    label: string
    detail?: string | null
  }

  let { used = 0, total = 0, label, detail = null }: Props = $props()

  // Same arc geometry as the traffic gauges, but linear: this is a proportion
  // of a known total rather than a rate spanning several decades.
  const R = 52
  const CX = 60
  const CY = 60
  const START = 135
  const SWEEP = 270

  const frac = $derived(total > 0 ? Math.min(1, Math.max(0, used / total)) : 0)
  const pct = $derived(Math.round(frac * 100))

  // Amber and red mark the point where free space or memory starts to matter,
  // so a full disk reads as a problem rather than just a large number.
  const tone = $derived(pct >= 90 ? 'text-red-600' : pct >= 75 ? 'text-amber-500' : 'text-accent')

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
      <path d={arc(0, frac)} fill="none" stroke="currentColor" class={tone} stroke-width="9" stroke-linecap="round" />
    {/if}
    <text x={CX} y={CY - 2} text-anchor="middle" class="fill-zinc-900 text-[19px] font-semibold">{pct}</text>
    <text x={CX} y={CY + 14} text-anchor="middle" class="fill-zinc-500 text-[9px]">% used</text>
  </svg>
  <p class="mt-1 text-sm font-medium text-zinc-700">{t(label)}</p>
  {#if detail}<p class="text-xs text-zinc-500">{detail}</p>{/if}
</div>
