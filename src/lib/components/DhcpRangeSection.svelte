<script lang="ts">
  // The DHCP pool as the addresses it actually hands out.
  //
  // The document stores `lease-first` (a last octet) and `lease-count`, which is
  // how dnsmasq thinks rather than how anyone reads their own network. This
  // shows the first and last address and writes the pair back.
  //
  // `lease-first` being a last octet is the constraint that shapes this: the
  // arithmetic only holds while the last octet is free to vary, so a prefix
  // longer than /24 falls back to editing the stored numbers rather than
  // computing a range that would be wrong.
  import Field from './Field.svelte'
  import { def_get, ref_resolve } from '../schema.js'
  import { t } from '../i18n.svelte.js'
  import { DESCRIPTIONS } from '../descriptions.js'
  import type { JsonSchemaNode } from '../schema'

  interface Props {
    ipv4: Record<string, unknown>
  }

  let { ipv4 }: Props = $props()

  const poolDef = ref_resolve(def_get('interface.ipv4.dhcp-pool')!)
  const poolProps: Record<string, JsonSchemaNode> = poolDef.properties ?? {}

  const MIN_HOST = 1
  const MAX_HOST = 254

  // A downstream interface always serves a pool, matching DhcpPoolSection.
  $effect(() => {
    if (ipv4['dhcp-pool'] == null) ipv4['dhcp-pool'] = {}
  })

  const pool = $derived((ipv4['dhcp-pool'] ?? {}) as Record<string, unknown>)

  // The first three octets of the subnet, or null when it is not a plain
  // dotted-quad with a prefix that leaves the last octet to us.
  const base = $derived.by(() => {
    const m = String(ipv4.subnet ?? '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
    if (!m) return null
    const octets = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (octets.some((o) => o > 255)) return null
    const prefix = Number(m[5])
    if (prefix < 8 || prefix > 24) return null
    return octets.join('.')
  })

  const first = $derived(Number(pool['lease-first'] ?? 0))
  const count = $derived(Number(pool['lease-count'] ?? 0))

  const firstAddr = $derived(base && first ? `${base}.${first}` : '')
  const lastAddr = $derived(base && first && count ? `${base}.${Math.min(first + count - 1, MAX_HOST)}` : '')

  function pool_set(k: string, v: unknown) {
    const target = ipv4['dhcp-pool'] as Record<string, unknown>
    if (v === '' || v === undefined || v === null) delete target[k]
    else target[k] = v
  }

  // Editing either end rewrites the stored pair. Out-of-range or reversed input
  // is ignored rather than written, so a half-typed address cannot produce a
  // nonsensical pool.
  function last_octet(value: string): number | null {
    const m = value.trim().match(/^(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.)?(\d{1,3})$/)
    if (!m) return null
    const n = Number(m[1])
    return n >= MIN_HOST && n <= MAX_HOST ? n : null
  }

  function first_input(value: string) {
    const n = last_octet(value)
    if (n == null) return
    const end = first + count - 1
    pool_set('lease-first', n)
    if (end >= n) pool_set('lease-count', end - n + 1)
  }

  function last_input(value: string) {
    const n = last_octet(value)
    if (n == null || n < first) return
    pool_set('lease-count', n - first + 1)
  }

  const available = $derived(count > 0 ? count : 0)
</script>

<div class="flex flex-col gap-4">
  {#if base}
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-zinc-700">{t('Address range')}</span>
      <div class="flex items-center gap-2">
        <input
          class="input"
          value={firstAddr}
          inputmode="numeric"
          autocomplete="off"
          onchange={(e) => first_input(e.currentTarget.value)}
        />
        <span class="flex-shrink-0 text-xs text-zinc-500">{t('to')}</span>
        <input
          class="input"
          value={lastAddr}
          inputmode="numeric"
          autocomplete="off"
          onchange={(e) => last_input(e.currentTarget.value)}
        />
      </div>
      <p class="text-[11px] leading-snug text-zinc-500">
        {t('{count, plural, one {# address available} other {# addresses available}}', { count: available })}
      </p>
    </div>
  {:else}
    <!-- Without a subnet we can name the addresses from, the stored numbers are
         the honest thing to show. -->
    <Field
      obj={pool}
      key="lease-first"
      onset={pool_set}
      schema={poolProps['lease-first'] ?? {}}
      describe={DESCRIPTIONS['lease-first']}
    />
    <Field
      obj={pool}
      key="lease-count"
      onset={pool_set}
      schema={poolProps['lease-count'] ?? {}}
      describe={DESCRIPTIONS['lease-count']}
    />
  {/if}

  <Field
    obj={pool}
    key="lease-time"
    onset={pool_set}
    schema={poolProps['lease-time'] ?? {}}
    describe={DESCRIPTIONS['lease-time']}
  />
</div>
