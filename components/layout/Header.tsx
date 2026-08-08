import Link from 'next/link'
import { type Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import { ThemeToggle } from '@/components/controls/ThemeToggle'
import { LocaleNav } from '@/components/controls/LocaleNav'
import { MobileMenu } from './MobileMenu'
import styles from './Header.module.css'

export function Header({ locale, siteName }: { locale: Locale; siteName: string }) {
  const dict = getDictionary(locale)
  const localeNames = { it: dict.localeNameIt, en: dict.localeNameEn }

  return (
    <header className={styles.header}>
      <Link href={pathFor(locale, { key: 'home' })} className={styles.name}>
        {siteName}
      </Link>

      <nav aria-label={dict.navPrimary} className={styles.nav}>
        <Link href={pathFor(locale, { key: 'gallery' })} className={`${styles.link} label`}>
          {dict.navGallery}
        </Link>
        <Link href={pathFor(locale, { key: 'projects' })} className={`${styles.link} label`}>
          {dict.navProjects}
        </Link>
        <Link href={pathFor(locale, { key: 'about' })} className={`${styles.link} label`}>
          {dict.navAbout}
        </Link>
      </nav>

      <div className={styles.controls}>
        <LocaleNav current={locale} groupLabel={dict.localeGroup} names={localeNames} />
        <ThemeToggle label={dict.themeToggle} />
      </div>

      {/* Sotto il breakpoint i controlli vivono qui: nome, lingua e tema su una
          riga sola sfondavano il viewport, e comprimerli avrebbe reso le aree
          di tocco piu piccole del minimo di 44px. */}
      <div className={styles.menu}>
        <MobileMenu locale={locale} dict={dict} localeNames={localeNames} />
      </div>
    </header>
  )
}
