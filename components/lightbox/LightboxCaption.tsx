import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'
import styles from './LightboxCaption.module.css'

export function LightboxCaption({ photo, locale }: { photo: GalleryPhoto; locale: Locale }) {
  if (!photo.title && !photo.year && !photo.place) return null

  return (
    <figcaption className={styles.caption}>
      {photo.title ? (
        <span lang={photo.titleLang === locale ? undefined : photo.titleLang}>{photo.title}</span>
      ) : null}
      {photo.place ? (
        <span lang={photo.placeLang === locale ? undefined : photo.placeLang}>{photo.place}</span>
      ) : null}
      {photo.year ? <span>{photo.year}</span> : null}
    </figcaption>
  )
}
