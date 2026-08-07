'use client'

import type { Locale } from '@/lib/i18n/locales'
import { SanityImage } from '@/components/media/SanityImage'
import { sizesForTile } from '@/lib/gallery/sizes'
import type { GalleryPhoto } from './types'
import styles from './PhotoTile.module.css'

export function PhotoTile({
  photo,
  rowSumAr,
  index,
  locale,
  onOpen,
}: {
  photo: GalleryPhoto
  rowSumAr: number
  index: number
  locale: Locale
  onOpen: (index: number) => void
}) {
  return (
    <button
      type="button"
      className={styles.tile}
      style={{ '--ar': String(photo.ar), flexGrow: photo.ar } as React.CSSProperties}
      onClick={() => onOpen(index)}
    >
      <SanityImage
        photo={{
          url: photo.url,
          aspectRatio: photo.ar,
          lqip: photo.lqip,
          alt: photo.alt,
          altLang: photo.altLang,
        }}
        sizes={sizesForTile(rowSumAr, photo.ar)}
        locale={locale}
      />
    </button>
  )
}
