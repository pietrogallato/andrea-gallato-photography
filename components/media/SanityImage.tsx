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
}: {
  photo: PhotoImage
  sizes: string
  locale: Locale
  priority?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  const style = { '--ar': String(photo.aspectRatio) } as React.CSSProperties
  const lang = photo.altLang === locale ? undefined : photo.altLang

  if (failed) {
    return (
      <div className={`${styles.wrapper} ${styles.failed} ${className ?? ''}`} style={style}>
        <span className={styles.fallbackText} lang={lang}>
          {photo.alt}
        </span>
      </div>
    )
  }

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} style={style}>
      <Image
        loader={sanityImageLoader}
        src={photo.url}
        alt={photo.alt}
        lang={lang}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={photo.lqip ? 'blur' : 'empty'}
        blurDataURL={photo.lqip ?? undefined}
        onError={() => setFailed(true)}
        className={styles.image}
      />
    </div>
  )
}
