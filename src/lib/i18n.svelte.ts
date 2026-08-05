import { createIntl, createIntlCache } from '@formatjs/intl'
import type { PrimitiveType } from 'intl-messageformat'
import enGB from './locales/en-GB.json'

// English source strings are the message ids. A locale catalogue (e.g. en-GB)
// overrides any of them, including with ICU select/plural for value-dependent or
// pluralised text. Missing keys fall back to the source string.
const CATALOGUES: Record<string, Record<string, string>> = {
  'en-GB': enGB
}

const DEFAULT_LOCALE = 'en-GB'
const cache = createIntlCache()

export const i18n = $state({ locale: DEFAULT_LOCALE })

export const locales = Object.keys(CATALOGUES)

function intl_for(locale: string) {
  return createIntl(
    {
      locale,
      defaultLocale: DEFAULT_LOCALE,
      messages: CATALOGUES[locale] ?? {},
      onError: () => {}
    },
    cache
  )
}

const intl = $derived(intl_for(i18n.locale))

export function set_locale(locale: string) {
  if (CATALOGUES[locale]) i18n.locale = locale
}

export function t(message: string | null | undefined, values?: Record<string, PrimitiveType>): string {
  if (message == null || message === '') return ''
  return intl.formatMessage({ id: message, defaultMessage: message }, values)
}
