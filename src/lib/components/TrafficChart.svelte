<script>
  import { bits_format } from '../traffic.svelte.js'
  import { t } from '../i18n.svelte.js'

  let { down = [], up = [], leftLabel = '', rightLabel = '' } = $props()

  const W = 600
  const H = 160
  const MID = H / 2
  const PAD = 2

  // Both directions share a scale so their relative size stays readable.
  const peak = $derived(Math.max(1, ...down, ...up))
  const peakFmt = $derived(bits_format(peak))

  function area(values, up_ward) {
    const n = values.length
    if (!n) return ''
    const step = W / Math.max(1, n - 1)
    const span = MID - PAD
    const pts = values.map((v, i) => {
      const x = i * step
      const h = (Math.max(0, v) / peak) * span
      return `${x.toFixed(1)},${(up_ward ? MID - h : MID + h).toFixed(1)}`
    })
    return `M 0,${MID} L ${pts.join(' L ')} L ${W},${MID} Z`
  }
</script>

<div class="rounded-base border border-zinc-200 px-4 py-3">
  <div class="mb-1 flex items-baseline justify-between text-xs text-zinc-500">
    <span>{t('Peak')} {peakFmt.value} {peakFmt.unit}</span>
    <span class="flex items-center gap-3">
      <span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-accent"></span>{t('Download')}</span>
      <span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-zinc-400"></span>{t('Upload')}</span>
    </span>
  </div>

  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" class="h-40 w-full">
    <path d={area(down, true)} class="fill-accent/70" />
    <path d={area(up, false)} class="fill-zinc-400/70" />
    <line x1="0" y1={MID} x2={W} y2={MID} stroke="currentColor" class="text-zinc-300" stroke-width="1" vector-effect="non-scaling-stroke" />
  </svg>

  <div class="mt-1 flex justify-between text-xs text-zinc-500">
    <span>{leftLabel}</span>
    <span>{rightLabel}</span>
  </div>
</div>
