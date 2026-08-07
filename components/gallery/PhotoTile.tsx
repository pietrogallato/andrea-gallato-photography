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
      // Solo --ar inline. La crescita la deriva il CSS con flex-grow: var(--ar):
      // impostarla inline la renderebbe imbattibile da qualunque foglio di
      // stile, e la regola dell ultima riga non potrebbe piu disattivarla.
      style={{ '--ar': String(photo.ar) } as React.CSSProperties}
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
