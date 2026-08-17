'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import sanityImageLoader from '@/lib/sanity/imageUrl.loader'
import styles from './SanityImage.module.css'

export type PhotoImage = {
  url: string
  aspectRatio: number
  lqip?: string | null
  alt: string
  altLang: Locale
}

export function SanityImage({
  photo,
  sizes,
  locale,
  priority = false,
  className,
  onLoad,
  ref,
}: {
  photo: PhotoImage
  sizes: string
  locale: Locale
  priority?: boolean
  className?: string
  /** Scatta quando i pixel sono arrivati. Serve a chi mostra un'attesa. */
  onLoad?: () => void
  /**
   * Il riquadro esterno, quello che porta il rapporto d'aspetto.
   *
   * E l'unico elemento che coincide sempre con la fotografia dipinta: la
   * lightbox lo misura per sapere quanto puo ingrandire e fin dove puo
   * spostarsi, e il contenitore attorno da ingranditi e piu grande di lei.
   */
  ref?: React.Ref<HTMLDivElement>
}) {
  // L'URL che ha fallito, non un booleano: cosi cambiare fotografia azzera lo
  // stato da solo. Con un booleano, una fotografia rotta lasciava il ripiego
  // acceso anche su tutte le successive, perche lo stato sopravvive al
  // cambio di prop.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = failedUrl === photo.url

  const style = { '--ar': String(photo.aspectRatio) } as React.CSSProperties
  const lang = photo.altLang === locale ? undefined : photo.altLang

  if (failed) {
    return (
      <div ref={ref} className={`${styles.wrapper} ${styles.failed} ${className ?? ''}`} style={style}>
        <span className={styles.fallbackText} lang={lang}>
          {photo.alt}
        </span>
      </div>
    )
  }

  return (
    <div ref={ref} className={`${styles.wrapper} ${className ?? ''}`} style={style}>
      <Image
        // La `key` rimonta l'elemento quando cambia la fotografia. Senza,
        // React riusa lo stesso <img> cambiandogli `src`, e il browser
        // continua a dipingere la fotografia precedente finche la nuova non e
        // decodificata: nella lightbox si vedeva lo scatto di prima al posto
        // di un'attesa. Rimontando, il segnaposto sfocato torna subito in
        // scena.
        key={photo.url}
        loader={sanityImageLoader}
        src={photo.url}
        alt={photo.alt}
        lang={lang}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={photo.lqip ? 'blur' : 'empty'}
        blurDataURL={photo.lqip ?? undefined}
        onLoad={onLoad}
        onError={() => setFailedUrl(photo.url)}
        className={styles.image}
      />
    </div>
  )
}
