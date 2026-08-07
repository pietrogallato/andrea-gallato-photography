'use server'

import { sanityFetch } from '@/lib/sanity/fetch'
import { galleryPageQuery, galleryCountQuery } from '@/lib/sanity/queries'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import { packRows, K_DESKTOP } from '@/lib/gallery/packRows'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from '@/components/gallery/types'
import type { Locale } from '@/lib/i18n/locales'

export const PAGE_SIZE = 24

export type LoadMoreResult = {
  rows: Row<GalleryPhoto>[]
  hasMore: boolean
  total: number
}

export async function loadMorePhotos(offset: number, locale: Locale): Promise<LoadMoreResult> {
  const total = await sanityFetch({ query: galleryCountQuery, tags: ['gallery'] })

  const raw = await sanityFetch({
    query: galleryPageQuery,
    params: { start: offset, end: offset + PAGE_SIZE },
    tags: ['gallery'],
  })

  const photos = (raw ?? []).map((p) => toGalleryPhoto(p, locale))

  return {
    rows: packRows(photos, K_DESKTOP),
    // Confronta col totale quante fotografie il client ha ora in mano. Dedurre
    // hasMore dal solo numero di elementi ricevuti (photos.length === PAGE_SIZE)
    // sbaglierebbe quando l ultimo gruppo e esattamente pieno.
    hasMore: offset + photos.length < (total ?? 0),
    total: total ?? 0,
  }
}
