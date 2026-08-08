'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { Lightbox } from '@/components/lightbox/Lightbox'
import { useLightbox } from '@/components/lightbox/useLightbox'
import styles from './ProjectSequence.module.css'

export function ProjectSequence({
  photos,
  locale,
  dict,
}: {
  photos: GalleryPhoto[]
  locale: Locale
  dict: Dictionary
}) {
  const { openIndex, open, close, navigate } = useLightbox()

  if (photos.length === 0) return null

  return (
    <>
      <div className={styles.sequence}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className={styles.item}
            style={{ '--ar': String(photo.ar) } as React.CSSProperties}
            onClick={(event) => {
              // L origine viene passata esplicitamente: Safari non mette a
              // fuoco un button quando lo si clicca, quindi dedurla da
              // document.activeElement darebbe <body> e alla chiusura il
              // focus non tornerebbe alla fotografia.
              event.currentTarget.focus()
              open(index, event.currentTarget)
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
              sizes="(max-width: 767px) 100vw, min(100vw, 76rem)"
              locale={locale}
            />
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          locale={locale}
          dict={dict}
          onClose={close}
          onNavigate={navigate}
        />
      ) : null}
    </>
  )
}
