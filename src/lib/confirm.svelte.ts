interface ConfirmState {
  open: boolean
  message: string
  confirmLabel: string | null
  _resolve: ((ok: boolean) => void) | null
}

export const confirmState = $state<ConfirmState>({
  open: false,
  message: '',
  confirmLabel: null,
  _resolve: null
})

// `confirmLabel` names the destructive action; it defaults to Remove, which is
// what most call sites are asking about.
export function confirm(message: string, confirmLabel?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmState.message = message
    confirmState.confirmLabel = confirmLabel ?? null
    confirmState.open = true
    confirmState._resolve = resolve
  })
}

export function confirm_answer(ok: boolean) {
  const resolve = confirmState._resolve
  confirmState.open = false
  confirmState.message = ''
  confirmState.confirmLabel = null
  confirmState._resolve = null
  if (resolve) resolve(ok)
}
