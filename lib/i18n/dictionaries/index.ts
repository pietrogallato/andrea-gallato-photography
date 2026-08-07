import { type Locale } from '../locales'
import { it, type Dictionary } from './it'
import { en } from './en'

const DICTIONARIES: Record<Locale, Dictionary> = { it, en }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

export type { Dictionary }
