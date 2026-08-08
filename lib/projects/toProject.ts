import { pickLocalized } from '@/lib/i18n/localize'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'

type RawPhoto = Parameters<typeof toGalleryPhoto>[0]

type RawProject = {
  _id: string
  titleIt?: string | null
  titleEn?: string | null
  descriptionIt?: string | null
  descriptionEn?: string | null
  year?: number | null
  slug?: string | null
  cover?: RawPhoto | null
  photos?: RawPhoto[] | null
}

export type ProjectSummary = {
  id: string
  slug: string
  title: string
  titleLang: Locale
  year?: number
  cover: GalleryPhoto | null
}

export type ProjectDetail = ProjectSummary & {
  description: string
  descriptionLang: Locale
  photos: GalleryPhoto[]
}

export function toProjectSummary(raw: RawProject, locale: Locale): ProjectSummary {
  const title = pickLocalized({ it: raw.titleIt, en: raw.titleEn }, locale)

  return {
    id: raw._id,
    slug: raw.slug ?? '',
    title: title.value,
    titleLang: title.lang,
    year: raw.year ?? undefined,
    // La copertina e obbligatoria a schema, ma un riferimento appeso la
    // azzera: la pagina deve reggerlo invece di rompersi.
    cover: raw.cover ? toGalleryPhoto(raw.cover, locale) : null,
  }
}

export function toProjectDetail(
  raw: RawProject | null | undefined,
  locale: Locale,
): ProjectDetail | null {
  if (!raw) return null

  const description = pickLocalized({ it: raw.descriptionIt, en: raw.descriptionEn }, locale)

  return {
    ...toProjectSummary(raw, locale),
    description: description.value,
    descriptionLang: description.lang,
    // L ordine e quello dell array photos, cioe la sequenza scelta
    // dall editor: non va riordinato per orderRank, che e l ordinamento
    // globale della galleria.
    photos: (raw.photos ?? []).map((p) => toGalleryPhoto(p, locale)),
  }
}
