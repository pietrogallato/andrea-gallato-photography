'use client'

import { useEffect, useRef } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { LightboxCaption } from './LightboxCaption'
import { useScrollLock } from './useScrollLock'
import styles from './Lightbox.module.css'

export function Lightbox({
  photos,
  index,
  locale,
  dict,
  onClose,
  onNavigate,
}: {
  photos: GalleryPhoto[]
  index: number
  locale: Locale
  dict: Dictionary
  onClose: () => void
  onNavigate: (next: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const photo = photos[index]

  useScrollLock()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, photos.length, onNavigate])

  const position = `${index + 1} / ${photos.length}`
  const label = photo.title ? `${photo.title} — ${position}` : `${dict.lightboxLabel} — ${position}`

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} surface-dark`}
      aria-label={label}
      // onCancel, non onClose. `cancel` scatta solo su una richiesta di
      // chiusura dell utente (Esc); `close` scatta per qualunque chiusura,
      // inclusa la nostra in fase di smontaggio. Collegare `close` fa
      // smontare la lightbox subito dopo l apertura in sviluppo, dove React
      // monta due volte: effect apre, cleanup chiama close() accodando
      // l evento, il secondo effect riapre, e l evento accodato arriva e
      // chiude tutto. E il lampo che si vede cliccando una fotografia.
      onCancel={onClose}
    >
      <div role="status" aria-live="polite" className="visually-hidden">
        {position}
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        autoFocus
      >
        {dict.lightboxClose}
      </button>

      <figure className={styles.figure}>
        <SanityImage
          photo={{ url: photo.url, aspectRatio: photo.ar, lqip: photo.lqip, alt: photo.alt, altLang: photo.altLang }}
          sizes="100vw"
          locale={locale}
          className={styles.image}
        />
        <LightboxCaption photo={photo} locale={locale} />
      </figure>

      <button
        type="button"
        className={styles.prev}
        onClick={() => onNavigate(index - 1)}
        disabled={index === 0}
      >
        {dict.lightboxPrev}
      </button>

      <button
        type="button"
        className={styles.next}
        onClick={() => onNavigate(index + 1)}
        disabled={index === photos.length - 1}
      >
        {dict.lightboxNext}
      </button>
    </dialog>
  )
}
