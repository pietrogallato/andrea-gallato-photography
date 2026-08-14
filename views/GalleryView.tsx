import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { caricaRighe } from '@/lib/gallery/caricaRighe'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './GalleryView.module.css'

export async function GalleryView({
  locale,
  preview = false,
}: {
  locale: Locale
  preview?: boolean
}) {
  const dict = getDictionary(locale)
  // `caricaRighe` e non la Server Action: durante il rendering non si
  // legge `draftMode()`, che renderebbe dinamica la pagina per tutti.
  const first = await caricaRighe(0, locale, preview)

  return (
    <div className={styles.gallery}>
      <h1 className={styles.title}>{dict.navGallery}</h1>

      {first.rows.length === 0 ? (
        <EmptyState message={dict.emptyGallery} />
      ) : (
        <GalleryClient
          initialRows={first.rows}
          initialHasMore={first.hasMore}
          locale={locale}
          dict={dict}
        />
      )}
    </div>
  )
}
