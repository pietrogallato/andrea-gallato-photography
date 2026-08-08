'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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

  // Elemento da cui la lightbox e stata aperta, per restituirgli il focus.
  // Il ripristino automatico di showModal() non e affidabile: su WebKit il
  // focus finisce su body, perche la dialog viene smontata da React nello
  // stesso momento in cui il browser proverebbe a ripristinarlo.
  const originRef = useRef<HTMLElement | null>(null)

  const photos = rows.flatMap((row) => row.items)

  function open(index: number) {
    originRef.current = document.activeElement as HTMLElement | null
    setOpenIndex(index)
  }

  function close() {
    setOpenIndex(null)
  }

  // Il focus va restituito DOPO lo smontaggio, non dentro close(): li React
  // non ha ancora rimosso la dialog, e chiudendola il browser sposterebbe di
  // nuovo il focus subito dopo. Un effect gira a commit avvenuto.
  useEffect(() => {
    if (openIndex === null) originRef.current?.focus()
  }, [openIndex])

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
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  )
}
