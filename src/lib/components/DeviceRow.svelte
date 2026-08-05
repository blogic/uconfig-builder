<script lang="ts">
  import {
    device_icon,
    device_name,
    device_ip,
    device_traffic,
    bytes_format,
    rate_format,
    signal_class
  } from '../device-icons.js'
  import { t } from '../i18n.svelte.js'
  import type { DeviceEntry } from '../devices.svelte.js'

  interface Props {
    device: DeviceEntry
    offline?: boolean
  }

  let { device: d, offline = false }: Props = $props()

  const traffic = $derived(device_traffic(d))
  const wifi = $derived(d.wifi)
</script>

<li class="flex items-start gap-3 py-3">
  <i class="bi {device_icon(d)} mt-0.5 flex-shrink-0 text-lg {offline ? 'text-zinc-400' : 'text-zinc-600'}"></i>

  <div class="min-w-0 flex-1">
    <div class="flex items-baseline gap-2">
      <span class="truncate text-sm font-semibold {offline ? 'text-zinc-500' : 'text-zinc-900'}">{device_name(d)}</span>
      {#if d.fingerprint?.device}
        <span class="hidden truncate text-xs text-zinc-400 sm:inline">{d.fingerprint.device}</span>
      {/if}
    </div>

    <div class="truncate font-mono text-xs text-zinc-400">
      {#if device_ip(d)}{device_ip(d)} · {/if}{d.mac}
    </div>

    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
      {#if wifi}
        <span class="flex items-center gap-1">
          <i class="bi bi-wifi"></i>
          {wifi.band ?? ''}{#if wifi.ssid} · {wifi.ssid}{/if}{#if wifi.host} · {wifi.host}{/if}
        </span>
        {#if wifi.signal != null}
          <span class={signal_class(wifi.signal)}>{wifi.signal} dBm</span>
        {/if}
        {#if rate_format(wifi.rx_rate) || rate_format(wifi.tx_rate)}
          <span class="flex items-center gap-1" title={t('Negotiated link rate')}>
            <i class="bi bi-speedometer2"></i>
            {rate_format(Math.max(wifi.rx_rate ?? 0, wifi.tx_rate ?? 0))}
            {#if wifi.mode}<span class="uppercase text-zinc-400">{wifi.mode}</span>{/if}
          </span>
        {/if}
      {:else if d.online}
        <span class="flex items-center gap-1"><i class="bi bi-plug"></i>{t('Wired')}</span>
      {/if}
    </div>
  </div>

  {#if traffic}
    <div class="flex-shrink-0 text-right font-mono text-xs text-zinc-500">
      {#if traffic.split}
        <div>↓ {bytes_format(traffic.down ?? 0)}</div>
        <div>↑ {bytes_format(traffic.up ?? 0)}</div>
      {:else}
        <div>{bytes_format(traffic.total ?? 0)}</div>
      {/if}
    </div>
  {/if}
</li>
