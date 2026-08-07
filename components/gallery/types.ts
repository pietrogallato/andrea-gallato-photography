import type { Locale } from '@/lib/i18n/locales'

export type GalleryPhoto = {
  id: string
  ar: number
  url: string
  lqip: string | null
  alt: string
  altLang: Locale
  title?: string
  titleLang?: Locale
  place?: string
  placeLang?: Locale
  year?: number
}
