import Link from 'next/link'
import { type Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor, alternatePaths } from '@/lib/i18n/routes'
import { ThemeToggle } from '@/components/controls/ThemeToggle'
import { LocaleSwitcher } from '@/components/controls/LocaleSwitcher'
import styles from './Header.module.css'

export function Header({ locale, siteName }: { locale: Locale; siteName: string }) {
  const dict = getDictionary(locale)

  return (
    <header className={styles.header}>
      <Link href={pathFor(locale, { key: 'home' })} className={styles.name}>
        {siteName}
      </Link>

      <nav aria-label={dict.navGallery} className={styles.nav}>
        <Link href={pathFor(locale, { key: 'gallery' })} className={styles.link}>
          {dict.navGallery}
        </Link>
      </nav>

      <div className={styles.controls}>
        <LocaleSwitcher
          current={locale}
          paths={alternatePaths({ key: 'home' })}
          groupLabel={dict.localeGroup}
          names={{ it: dict.localeNameIt, en: dict.localeNameEn }}
        />
        <ThemeToggle label={dict.themeToggle} />
      </div>
    </header>
  )
}
