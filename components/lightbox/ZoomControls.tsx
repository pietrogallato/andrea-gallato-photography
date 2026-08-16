'use client'

import { useLayoutEffect, useRef } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import styles from './Lightbox.module.css'

/**
 * A riposo c e un comando solo. Il ritorno a schermo intero compare quando
 * serve, ed e anche l unico segnale visibile che si e dentro l altro stato.
 *
 * Nessun annuncio del livello: la lightbox ha una sola regione live e dice la
 * posizione. Una seconda metterebbe due annunci in coda a ogni freccia, e chi
 * ascolta si sentirebbe dire lo zoom quando voleva sapere a che fotografia e.
 */
export function ZoomControls({
  dict,
  ingrandito,
  alTetto,
  onIngrandisci,
  onRiduci,
  onAzzera,
}: {
  dict: Dictionary
  ingrandito: boolean
  alTetto: boolean
  onIngrandisci: () => void
  onRiduci: () => void
  onAzzera: () => void
}) {
  const ingrandisciRef = useRef<HTMLButtonElement>(null)
  const statoPrecedente = useRef(ingrandito)

  /**
   * Il fuoco che resta orfano quando un comando sparisce.
   *
   * Cambiando stato smontano dei comandi: qui «riduci» e «torna a schermo
   * intero», e nello stesso commit le frecce e la didascalia della lightbox. Se
   * a smontare e proprio quello che ha il fuoco — e succede sempre, perche e il
   * comando che si e appena premuto — il fuoco cade sul body e il Tab
   * successivo, dentro un dialog modale, riparte dal primo comando del dialog,
   * cioe la chiusura. E la stessa trappola che poco piu sotto si evita al tetto
   * con `aria-disabled`, e va evitata anche qui: chi torna a schermo intero da
   * tastiera si troverebbe altrimenti a un tasto dal chiudere per sbaglio la
   * fotografia che stava guardando, senza che nulla glielo abbia annunciato.
   *
   * Si atterra su «ingrandisci» perche e l'unico comando montato in tutti e due
   * gli stati, quindi il fuoco resta dov'e la mano.
   *
   * `useLayoutEffect` e non `useEffect`: il rimedio deve stare nello stesso
   * fotogramma dello smontaggio, altrimenti esiste un istante reale in cui il
   * dialog non ha fuoco e un tasto premuto li dentro va perduto.
   */
  useLayoutEffect(() => {
    const cambiato = statoPrecedente.current !== ingrandito
    statoPrecedente.current = ingrandito
    if (!cambiato) return
    // Solo se non c e piu nulla di focalizzato. Un cambio di stato che arriva
    // da una pizzicata o dalla rotella non deve strappare il fuoco a un comando
    // che e rimasto al suo posto: sarebbe uno spostamento non richiesto, e chi
    // stava per premere «chiudi» se lo troverebbe cambiato sotto le dita.
    const attivo = document.activeElement
    if (attivo && attivo !== document.body) return
    ingrandisciRef.current?.focus()
  }, [ingrandito])

  return (
    <div className={styles.zoom}>
      {ingrandito ? (
        <button type="button" className={styles.zoomButton} onClick={onRiduci}>
          <span className="visually-hidden">{dict.lightboxZoomOut}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}

      {/* Al tetto il comando diventa inerte, ma resta nel giro del Tab.
          `disabled` vero butta via il fuoco di chi lo stava premendo:
          **misurato in Chromium 151.0.7922.34 il 2026-08-16**, dentro un
          dialog aperto con showModal(), disabilitare il pulsante che ha il
          fuoco porta document.activeElement a BODY e il Tab successivo
          riparte dal primo comando del dialog — da noi la chiusura. Chi arriva
          al tetto da tastiera si troverebbe cosi a un tasto dal chiudere per
          sbaglio la fotografia che stava guardando, senza che nulla glielo
          abbia annunciato. Con aria-disabled, nella stessa prova, il fuoco
          resta dov'era. */}
      <button
        ref={ingrandisciRef}
        type="button"
        className={styles.zoomButton}
        onClick={alTetto ? undefined : onIngrandisci}
        aria-disabled={alTetto}
      >
        <span className="visually-hidden">{dict.lightboxZoomIn}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {ingrandito ? (
        <button type="button" className={styles.zoomButton} onClick={onAzzera}>
          <span className="visually-hidden">{dict.lightboxZoomReset}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
            <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
