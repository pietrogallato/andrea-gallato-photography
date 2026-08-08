'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Row } from '@/lib/gallery/packRows'
import { K_DESKTOP } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { PhotoRow } from './PhotoRow'
import styles from './PhotoGrid.module.css'

export function PhotoGrid({
  rows,
  locale,
  onOpen,
}: {
  rows: Row<GalleryPhoto>[]
  locale: Locale
  onOpen: (index: number, origin: HTMLElement | null) => void
}) {
  let offset = 0

  return (
    // --k e lo stesso bersaglio usato dal packer: l ultima riga lo usa per
    // darsi l altezza che avrebbe avuto una riga piena. Passarlo di qui evita
    // di duplicare il valore in CSS, dove divergerebbe in silenzio.
    <div className={styles.grid} style={{ '--k': String(K_DESKTOP) } as React.CSSProperties}>
      {rows.map((row, i) => {
        const start = offset
        offset += row.items.length
        return (
          <PhotoRow key={i} row={row} startIndex={start} locale={locale} onOpen={onOpen} />
        )
      })}
    </div>
  )
}
