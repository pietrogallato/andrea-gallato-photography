import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { loadMorePhotos } from '@/app/actions/loadMorePhotos'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './GalleryView.module.css'

export async function GalleryView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const first = await loadMorePhotos(0, locale)

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
