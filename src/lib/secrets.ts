// A value that must not be shown in the clear, and must not be pushed to a
// device that will not use it. One rule, so the widget that masks a value and
// the export that strips it cannot drift apart.
export function is_secret_key(key: string): boolean {
  return /password|passphrase|psk|secret/i.test(key) || key === 'key'
}
