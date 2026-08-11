<script lang="ts">
  import { t } from '../i18n.svelte.js'

  interface Props {
    values?: number[]
    // Samples the device's ring holds when full, which sets the time axis.
    capacity?: number
    // Top of the y axis, in the values' own unit. Fixed rather than fitted to
    // the data: scaled to its own peak, an idle trace wobbling by a tenth would
    // draw as a full-height mountain and every quiet device would look busy.
    full?: number
    // Appended to the peak reading, with its own leading space where the unit
    // takes one.
    unit?: string
    fill?: string
    leftLabel?: string
    rightLabel?: string
  }

  let {
    values = [],
    capacity = 0,
    full = 100,
    unit = '',
    fill = 'fill-accent/70',
    leftLabel = '',
    rightLabel = ''
  }: Props = $props()

  const W = 600
  const H = 120
  const PAD = 2

  const peak = $derived(values.length ? Math.max(...values) : 0)

  // The axis spans the whole ring, and the trace is anchored to the right, so
  // after a restart it grows in from the newest end instead of stretching two
  // minutes of history across the full window.
  const step = $derived(W / Math.max(1, Math.max(capacity, values.length) - 1))
  const x0 = $derived(W - step * Math.max(0, values.length - 1))

  function area(series: number[]): string {
    if (!series.length) return ''
    const span = H - PAD * 2
    const pts = series.map((v, i) => {
      const y = H - PAD - (Math.min(full, Math.max(0, v)) / full) * span
      return `${(x0 + i * step).toFixed(1)},${y.toFixed(1)}`
    })
    return `M ${x0.toFixed(1)},${H} L ${pts.join(' L ')} L ${W},${H} Z`
  }
</script>

<div class="mt-2">
  <div class="mb-1 text-xs text-zinc-500">{t('Peak')} {peak}{unit}</div>

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
    <path d={area(values)} class={fill} />
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
