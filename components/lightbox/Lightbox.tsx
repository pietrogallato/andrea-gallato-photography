'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { sizesForLightbox } from '@/lib/lightbox/sizes'
import { LightboxCaption } from './LightboxCaption'
import { useScrollLock } from './useScrollLock'
import styles from './Lightbox.module.css'

/**
 * Quanto si aspetta prima di dichiarare l'attesa.
 *
 * Una fotografia gia in cache arriva in pochi millisecondi: mostrare subito un
 * indicatore lo farebbe lampeggiare a ogni freccia. Sopra questa soglia,
 * invece, senza un segnale sembrerebbe che il tasto non abbia funzionato.
 */
const INDICATOR_DELAY_MS = 300

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

  const [loaded, setLoaded] = useState(false)
  const [waitedEnough, setWaitedEnough] = useState(false)

  useScrollLock()

  // Ogni cambio di fotografia riapre l'attesa. L'indicatore non compare
  // subito: sotto la soglia il caricamento e gia finito, e farlo lampeggiare
  // a ogni freccia sarebbe piu fastidioso del problema che risolve.
  useEffect(() => {
    setLoaded(false)
    setWaitedEnough(false)
    const timer = setTimeout(() => setWaitedEnough(true), INDICATOR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [photo.id])

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
      className={styles.dialog}
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

      {/* Icone con etichetta visivamente nascosta: il nome accessibile resta
          quello del dizionario, ma i lati della fotografia non portano piu
          righe di testo lunghe che le competevano. */}
      <button type="button" className={styles.close} onClick={onClose} autoFocus>
        <span className="visually-hidden">{dict.lightboxClose}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
          <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
        </svg>
      </button>

      {!loaded && waitedEnough ? (
        <div
          className={styles.loader}
          role="progressbar"
          aria-label={dict.lightboxLoading}
          // Nessun aria-valuenow: non sappiamo a che punto sia il
          // trasferimento, e dichiarare un valore falso e peggio che tacere.
        />
      ) : null}

      <figure className={styles.figure} aria-busy={!loaded}>
        <SanityImage
          photo={{ url: photo.url, aspectRatio: photo.ar, lqip: photo.lqip, alt: photo.alt, altLang: photo.altLang }}
          sizes={sizesForLightbox(photo.ar)}
          locale={locale}
          className={styles.image}
          onLoad={() => setLoaded(true)}
        />
        <LightboxCaption photo={photo} locale={locale} />
      </figure>

      <button
        type="button"
        className={styles.prev}
        onClick={() => onNavigate(index - 1)}
        disabled={index === 0}
      >
        <span className="visually-hidden">{dict.lightboxPrev}</span>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" strokeWidth="1.25">
          <path d="M15 4l-9 8 9 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        className={styles.next}
        onClick={() => onNavigate(index + 1)}
        disabled={index === photos.length - 1}
      >
        <span className="visually-hidden">{dict.lightboxNext}</span>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" strokeWidth="1.25">
          <path d="M9 4l9 8-9 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </dialog>
  )
}
