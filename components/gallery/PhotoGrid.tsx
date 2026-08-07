'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Row } from '@/lib/gallery/packRows'
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
  onOpen: (index: number) => void
}) {
  let offset = 0

  return (
    <div className={styles.grid}>
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
