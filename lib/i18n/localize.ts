import { type Locale } from './locales'

export type LocalizedField = {
  it?: string | null
  en?: string | null
}

export type Picked = {
  value: string
  lang: Locale
}

export function pickLocalized(
  field: LocalizedField | null | undefined,
  locale: Locale,
): Picked {
  const it = field?.it?.trim() ?? ''
  const en = field?.en?.trim() ?? ''

  if (locale === 'en') {
    if (en) return { value: en, lang: 'en' }
    if (it) return { value: it, lang: 'it' }
    return { value: '', lang: 'en' }
  }

  if (it) return { value: it, lang: 'it' }
  if (en) return { value: en, lang: 'en' }
  return { value: '', lang: 'it' }
}
