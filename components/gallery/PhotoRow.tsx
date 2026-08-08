'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { PhotoTile } from './PhotoTile'
import styles from './PhotoRow.module.css'

export function PhotoRow({
  row,
  startIndex,
  locale,
  onOpen,
}: {
  row: Row<GalleryPhoto>
  startIndex: number
  locale: Locale
  onOpen: (index: number, origin: HTMLElement | null) => void
}) {
  return (
    <div
      className={styles.row}
      data-row
      data-last={row.isLast ? 'true' : undefined}
      style={{ '--sum-ar': String(row.sumAr) } as React.CSSProperties}
    >
      {row.items.map((photo, i) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          rowSumAr={row.sumAr}
          index={startIndex + i}
          locale={locale}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
