import Link from 'next/link'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import styles from './LocaleSwitcher.module.css'

export function LocaleSwitcher({
  current,
  paths,
  groupLabel,
  names,
}: {
  current: Locale
  paths: Record<Locale, string>
  groupLabel: string
  names: Record<Locale, string>
}) {
  return (
    <nav aria-label={groupLabel} className={styles.switcher}>
      {LOCALES.map((locale) => {
        const isCurrent = locale === current
        return (
          <Link
            key={locale}
            href={paths[locale]}
            className={styles.link}
            data-current={isCurrent || undefined}
            {...(isCurrent
              ? { 'aria-current': 'true' as const }
              : { lang: locale, hrefLang: locale })}
          >
            {names[locale]}
          </Link>
        )
      })}
    </nav>
  )
}
