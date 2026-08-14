import { sanityFetch } from '@/lib/sanity/fetch'
import { galleryPageQuery, galleryCountQuery } from '@/lib/sanity/queries'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import { packRows, K_DESKTOP } from '@/lib/gallery/packRows'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from '@/components/gallery/types'
import type { Locale } from '@/lib/i18n/locales'
import { PAGE_SIZE } from '@/lib/gallery/pageSize'

export type LoadMoreResult = {
  rows: Row<GalleryPhoto>[]
  hasMore: boolean
  total: number
}

/**
 * Una pagina di galleria, impaginata in righe.
 *
 * Funzione normale, **non** una Server Action: e il percorso che usa la
 * pagina mentre viene resa. La Server Action gemella la avvolge per il
 * caricamento successivo, e li — e solo li — decide se siamo in anteprima.
 *
 * La separazione non e cosmetica. Se il flag `preview` fosse un argomento
 * della Server Action, chiunque potrebbe invocarla con `true` e leggersi le
 * bozze: un argomento che arriva dal client non e una credenziale.
 */
export async function caricaRighe(
  offset: number,
  locale: Locale,
  preview = false,
): Promise<LoadMoreResult> {
  const total = await sanityFetch({ query: galleryCountQuery, tags: ['gallery'], preview })

  const raw = await sanityFetch({
    query: galleryPageQuery,
    params: { start: offset, end: offset + PAGE_SIZE },
    tags: ['gallery'],
    preview,
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
