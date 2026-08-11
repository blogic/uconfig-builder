// How warm the device has been running, over the last hour.
//
// Sensors are whatever the board exposes, named by the kernel: a thermal zone's
// type, or a hwmon's name. The set differs per device, so nothing here assumes
// which sensors exist or that any particular one does.
//
// The device reports no thresholds, so there is nothing to say what this board
// considers hot. Readings are therefore rendered without a severity ramp: a
// number invented here would be wrong on the next board.

import { request } from './connection.svelte.ts'

export interface ThermalSensor {
  // The kernel's name for the part, e.g. `cpu-thermal` or `mt7915_phy0`.
  name: string
  // Degrees Celsius to a tenth. The newest entry of `history`, not a fresh
  // read, so it shares a clock with the series.
  temp_c: number
  // Oldest first. Grows to `samples` rather than starting padded, and a sensor
  // that appeared late carries a shorter one.
  history: number[]
}

export interface ThermalData {
  interval_s: number
  samples: number
  sensors: ThermalSensor[]
}

export const thermal = $state<{ data: ThermalData | null; error: string | null }>({
  data: null,
  error: null
})

export async function thermal_refresh() {
  try {
    thermal.data = (await request<ThermalData>('thermal', {})) ?? null
    thermal.error = null
  } catch (e) {
    thermal.error = e instanceof Error ? e.message : String(e)
  }
}

export function thermal_clear() {
  thermal.data = null
  thermal.error = null
}

// The warmest sensor, which is the one worth putting at the top of the card.
// Null rather than 0 when nothing is reported: a device with no sensors is not
// a device at 0 degrees.
export function thermal_peak(): ThermalSensor | null {
  const sensors = thermal.data?.sensors ?? []
  if (!sensors.length) return null
  return sensors.reduce((hot, s) => (s.temp_c > hot.temp_c ? s : hot))
}

// Wall clock the ring covers when full, which is the span the charts draw
// whether or not the device has been up long enough to fill it.
export function thermal_window_s(): number {
  const d = thermal.data
  return d ? d.samples * d.interval_s : 0
}
