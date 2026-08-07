import { type Locale } from '@/lib/i18n/locales'
import styles from './HomeView.module.css'

export function HomeView({ locale }: { locale: Locale }) {
  return (
    <div className={styles.home}>
      <h1 className={styles.title}>Andrea Gallato</h1>
      <p className={styles.intro} lang={locale}>
        {locale === 'it'
          ? 'Fotografia di paesaggio, street e ritratto.'
          : 'Landscape, street and portrait photography.'}
      </p>
    </div>
  )
}
