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
  onOpen: (index: number, origin: HTMLElement | null) => void
}) {
  return (
    <button
      type="button"
      className={styles.tile}
      // Solo --ar inline. La crescita la deriva il CSS con flex-grow: var(--ar):
      // impostarla inline la renderebbe imbattibile da qualunque foglio di
      // stile, e la regola dell ultima riga non potrebbe piu disattivarla.
      // --ar guida la crescita flex e il rapporto; --i scaglia l entrata.
      style={{ '--ar': String(photo.ar), '--i': String(index) } as React.CSSProperties}
      onClick={(event) => {
        // L origine viene passata esplicitamente, non dedotta dal focus:
        // Safari non mette a fuoco un button quando lo si clicca, quindi
        // document.activeElement sarebbe <body> e alla chiusura della
        // lightbox il focus non tornerebbe alla fotografia.
        event.currentTarget.focus()
        onOpen(index, event.currentTarget)
      }}
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
