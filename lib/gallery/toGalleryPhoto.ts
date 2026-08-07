import { pickLocalized } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'

type RawPhoto = {
  _id: string
  altIt?: string | null
  altEn?: string | null
  titleIt?: string | null
  titleEn?: string | null
  placeIt?: string | null
  placeEn?: string | null
  year?: number | null
  url?: string | null
  aspectRatio?: number | null
  lqip?: string | null
}

export function toGalleryPhoto(raw: RawPhoto, locale: Locale): GalleryPhoto {
  const alt = pickLocalized({ it: raw.altIt, en: raw.altEn }, locale)
  const title = pickLocalized({ it: raw.titleIt, en: raw.titleEn }, locale)
  const place = pickLocalized({ it: raw.placeIt, en: raw.placeEn }, locale)

  return {
    id: raw._id,
    ar: raw.aspectRatio && raw.aspectRatio > 0 ? raw.aspectRatio : 1,
    url: raw.url ?? '',
    lqip: raw.lqip ?? null,
    alt: alt.value,
    altLang: alt.lang,
    title: title.value || undefined,
    titleLang: title.value ? title.lang : undefined,
    place: place.value || undefined,
    placeLang: place.value ? place.lang : undefined,
    year: raw.year ?? undefined,
  }
}
