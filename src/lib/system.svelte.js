// Shared state for the System pages. Reboot, factory reset and firmware
// upgrade each own a page, but all three put the device out of reach while
// they run, so the busy state is held here rather than per page.

export const systemState = $state({
  busy: null, // 'rebooting' | 'resetting' | 'uploading' | 'upgrading'
  error: null
})

export const BUSY_MESSAGES = {
  rebooting: 'The device is rebooting…',
  resetting: 'The device is resetting to factory defaults…',
  uploading: 'Uploading firmware…',
  upgrading: 'Flashing firmware. The device will reboot when done.'
}

export function system_clear() {
  systemState.busy = null
  systemState.error = null
}
