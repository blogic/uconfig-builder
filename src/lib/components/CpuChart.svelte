<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Props {
    usage?: number[]
    // Samples the device's ring holds when full, which sets the time axis.
    capacity?: number
    leftLabel?: string
    rightLabel?: string
  }

  let { usage = [], capacity = 0, leftLabel = '', rightLabel = '' }: Props = $props()

  const W = 600
  const H = 120
  const PAD = 2

  // Full scale is fixed. Charted against its own peak, a 2% idle trace would
  // draw as a full-height mountain and every quiet device would look busy.
  const FULL = 100

  const peak = $derived(usage.length ? Math.max(...usage) : 0)

  // The axis spans the whole ring, and the trace is anchored to the right, so
  // after a restart it grows in from the newest end instead of stretching two
  // minutes of history across ten minutes of chart.
  const step = $derived(W / Math.max(1, Math.max(capacity, usage.length) - 1))
  const x0 = $derived(W - step * Math.max(0, usage.length - 1))

  function area(values: number[]): string {
    if (!values.length) return ''
    const span = H - PAD * 2
    const pts = values.map((v, i) => {
      const y = H - PAD - (Math.min(FULL, Math.max(0, v)) / FULL) * span
      return `${(x0 + i * step).toFixed(1)},${y.toFixed(1)}`
    })
    return `M ${x0.toFixed(1)},${H} L ${pts.join(' L ')} L ${W},${H} Z`
  }
</script>

<div class="mt-2">
  <div class="mb-1 text-xs text-zinc-500">{t('Peak')} {peak}%</div>

  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="h-24 w-full">
    <line
      x1="0"
      y1={H / 2}
      x2={W}
      y2={H / 2}
      stroke="currentColor"
      class="text-zinc-200"
      stroke-width="1"
      stroke-dasharray="4 4"
      vector-effect="non-scaling-stroke"
    />
    <path d={area(usage)} class="fill-accent/70" />
    <line
      x1="0"
      y1={H}
      x2={W}
      y2={H}
      stroke="currentColor"
      class="text-zinc-300"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
  </svg>

  <div class="mt-1 flex justify-between text-xs text-zinc-500">
    <span>{leftLabel}</span>
    <span>{rightLabel}</span>
  </div>
</div>
