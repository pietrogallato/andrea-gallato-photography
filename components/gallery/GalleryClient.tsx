'use client'

import { useState, useTransition } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { loadMorePhotos } from '@/app/actions/loadMorePhotos'
import { PhotoGrid } from './PhotoGrid'
import { LoadMoreButton } from './LoadMoreButton'
import { Lightbox } from '@/components/lightbox/Lightbox'

export function GalleryClient({
  initialRows,
  initialHasMore,
  locale,
  dict,
}: {
  initialRows: Row<GalleryPhoto>[]
  initialHasMore: boolean
  locale: Locale
  dict: Dictionary
}) {
  const [rows, setRows] = useState(initialRows)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [error, setError] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const photos = rows.flatMap((row) => row.items)

  function load() {
    setError(false)
    startTransition(async () => {
      try {
        const result = await loadMorePhotos(photos.length, locale)
        // Ogni gruppo e un blocco di righe indipendente: le righe gia rese
        // restano congelate e l append non le rigiustifica.
        setRows((current) => [...current, ...result.rows])
        setHasMore(result.hasMore)
      } catch {
        setError(true)
      }
    })
  }

  return (
    <>
      <PhotoGrid rows={rows} locale={locale} onOpen={setOpenIndex} />

      <LoadMoreButton
        hasMore={hasMore}
        loading={pending}
        error={error}
        dict={dict}
        onLoad={load}
      />

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          locale={locale}
          dict={dict}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  )
}
