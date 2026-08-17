'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { sizesForLightbox } from '@/lib/lightbox/sizes'
import { LightboxCaption } from './LightboxCaption'
import { ZoomControls } from './ZoomControls'
import { useScrollLock } from './useScrollLock'
import { useZoom } from './useZoom'
import { useGestiZoom } from './useGestiZoom'
import styles from './Lightbox.module.css'

/**
 * Quanto si aspetta prima di dichiarare l'attesa.
 *
 * Una fotografia gia in cache arriva in pochi millisecondi: mostrare subito un
 * indicatore lo farebbe lampeggiare a ogni freccia. Sopra questa soglia,
 * invece, senza un segnale sembrerebbe che il tasto non abbia funzionato.
 */
const INDICATOR_DELAY_MS = 300

/** Di quanto spostano le frecce a fotografia ingrandita, in pixel CSS. */
const PASSO_FRECCIA_PX = 60

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
  const superficieRef = useRef<HTMLDivElement>(null)
  // Due riferimenti, perche da ingranditi i due elementi si separano: la
  // superficie prende tutto lo schermo e ritaglia — ed e li che vanno raccolti
  // i gesti, altrimenti il dito sul nero attorno non sposterebbe nulla —
  // mentre la fotografia dentro resta grande quanto il suo rapporto le
  // concede. I conti dell'ingrandimento vogliono la seconda: il tetto e i
  // limiti dello spostamento parlano dei pixel dipinti, non della finestra.
  const fotografiaRef = useRef<HTMLDivElement>(null)
  const photo = photos[index]

  const [loaded, setLoaded] = useState(false)
  const [waitedEnough, setWaitedEnough] = useState(false)

  useScrollLock()

  const sizesDiRiposo = sizesForLightbox(photo.ar)
  const zoom = useZoom({ id: photo.id, url: photo.url, riquadroRef: fotografiaRef, sizesDiRiposo })
  const { inGesto } = useGestiZoom({ superficieRef, zoom })

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

  // Un solo listener per i tasti: aggiungerne un secondo per lo zoom farebbe
  // agire le frecce due volte.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Ctrl e Cmd sono l'ingrandimento del browser, che WCAG 1.4.4 pretende
      // resti disponibile. Non si intercetta e non si annulla.
      if (event.ctrlKey || event.metaKey) return

      if (event.key === '+' || event.key === '=') return zoom.ingrandisci()
      if (event.key === '-') return zoom.riduci()
      if (event.key === '0') return zoom.azzera()

      // Lo stesso tasto ha due significati, ma i due stati sono visibilmente
      // diversi: a riposo la fotografia sta tutta dentro lo schermo, ingrandita
      // no, e le frecce disegnate sono sparite.
      if (zoom.ingrandito) {
        if (event.key === 'ArrowRight') return zoom.sposta({ x: -PASSO_FRECCIA_PX, y: 0 })
        if (event.key === 'ArrowLeft') return zoom.sposta({ x: PASSO_FRECCIA_PX, y: 0 })
        if (event.key === 'ArrowDown') return zoom.sposta({ x: 0, y: -PASSO_FRECCIA_PX })
        if (event.key === 'ArrowUp') return zoom.sposta({ x: 0, y: PASSO_FRECCIA_PX })
        return
      }

      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, photos.length, onNavigate, zoom])

  const position = `${index + 1} / ${photos.length}`
  const label = photo.title ? `${photo.title} — ${position}` : `${dict.lightboxLabel} — ${position}`

  const variabili = {
    '--ar': String(photo.ar),
    '--zoom': String(zoom.livello),
    '--pan-x': `${zoom.pan.x}px`,
    '--pan-y': `${zoom.pan.y}px`,
  } as React.CSSProperties

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={label}
      // Ingrandendo, la cornice smette di essere un riquadro col rapporto
      // della fotografia e diventa lo schermo intero. E un cambio di forma,
      // quindi vive nel CSS: qui si dice soltanto in che stato siamo. Sul
      // dialog e non sulla figure perche anche i comandi sovrapposti, che
      // stanno fuori dalla figure, si regolano su questo.
      data-ingrandita={zoom.ingrandito ? 'true' : 'false'}
      // onCancel, non onClose. `cancel` scatta solo su una richiesta di
      // chiusura dell utente (Esc); `close` scatta per qualunque chiusura,
      // inclusa la nostra in fase di smontaggio. Collegare `close` fa
      // smontare la lightbox subito dopo l apertura in sviluppo, dove React
      // monta due volte: effect apre, cleanup chiama close() accodando
      // l evento, il secondo effect riapre, e l evento accodato arriva e
      // chiude tutto. E il lampo che si vede cliccando una fotografia.
      //
      // `cancel` e annullabile, ed e cio che rende possibile Esc a due tempi
      // senza spostarsi su un keydown parallelo: da ingranditi si torna a
      // schermo intero, e solo da li si chiude.
      onCancel={(event) => {
        if (zoom.ingrandito) {
          event.preventDefault()
          zoom.azzera()
          return
        }
        onClose()
      }}
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

      {/* La barra del secondo scaricamento e muta: in quel momento non si sta
          aspettando nulla, si sta per ricevere qualcosa di meglio. Dichiararlo
          con aria-busy direbbe che la fotografia non e disponibile mentre la
          si sta guardando benissimo. */}
      {zoom.attesa ? <div className={styles.loaderZoom} aria-hidden="true" /> : null}

      <figure className={styles.figure} aria-busy={!loaded}>
        <div
          ref={superficieRef}
          className={styles.superficie}
          style={variabili}
          data-gesto={inGesto ? 'true' : 'false'}
        >
          <SanityImage
            ref={fotografiaRef}
            photo={{ url: photo.url, aspectRatio: photo.ar, lqip: photo.lqip, alt: photo.alt, altLang: photo.altLang }}
            sizes={zoom.sizes}
            locale={locale}
            className={styles.image}
            onLoad={() => setLoaded(true)}
          />
        </div>
        {zoom.ingrandito ? null : <LightboxCaption photo={photo} locale={locale} />}
      </figure>

      {zoom.ingrandito ? null : (
        <>
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
        </>
      )}

      <ZoomControls
        dict={dict}
        ingrandito={zoom.ingrandito}
        alTetto={zoom.alTetto}
        onIngrandisci={zoom.ingrandisci}
        onRiduci={zoom.riduci}
        onAzzera={zoom.azzera}
      />
    </dialog>
  )
}
