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
import { useLightbox } from '@/components/lightbox/useLightbox'

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
  const [pending, startTransition] = useTransition()

  // Stato della lightbox condiviso con le pagine di progetto, incluso il
  // ripristino del focus, che va fatto dopo lo smontaggio.
  const { openIndex, open, close, navigate } = useLightbox()

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
      <PhotoGrid rows={rows} locale={locale} onOpen={open} />

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
          onClose={close}
          onNavigate={navigate}
        />
      ) : null}
    </>
  )
}
