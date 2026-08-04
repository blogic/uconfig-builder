export const confirmState = $state({
  open: false,
  message: '',
  confirmLabel: null,
  _resolve: null
})

// `confirmLabel` names the destructive action; it defaults to Remove, which is
// what most call sites are asking about.
export function confirm(message, confirmLabel) {
  return new Promise((resolve) => {
    confirmState.message = message
    confirmState.confirmLabel = confirmLabel ?? null
    confirmState.open = true
    confirmState._resolve = resolve
  })
}

export function confirm_answer(ok) {
  const resolve = confirmState._resolve
  confirmState.open = false
  confirmState.message = ''
  confirmState.confirmLabel = null
  confirmState._resolve = null
  if (resolve) resolve(ok)
}
