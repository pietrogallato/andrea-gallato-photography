import { type Locale } from '@/lib/i18n/locales'
import styles from './Footer.module.css'

export function Footer({
  locale,
  siteName,
  email,
}: {
  locale: Locale
  siteName: string
  email?: string
}) {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <p className={styles.line}>
        © {year} {siteName}
      </p>
      {email ? (
        <a href={`mailto:${email}`} className={styles.link}>
          {email}
        </a>
      ) : null}
    </footer>
  )
}
