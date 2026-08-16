'use client'

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

      <button
        type="button"
        className={styles.zoomButton}
        onClick={onIngrandisci}
        disabled={alTetto}
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
