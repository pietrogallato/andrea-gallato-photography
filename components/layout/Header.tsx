import Link from 'next/link'
import { type Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import { LocaleNav } from '@/components/controls/LocaleNav'
import { MobileMenu } from './MobileMenu'
import { PrimaryNav } from './PrimaryNav'
import styles from './Header.module.css'

export function Header({ locale, siteName }: { locale: Locale; siteName: string }) {
  const dict = getDictionary(locale)
  const localeNames = { it: dict.localeNameIt, en: dict.localeNameEn }

  return (
    <header className={styles.header}>
      <Link href={pathFor(locale, { key: 'home' })} className={styles.name}>
        {siteName}
      </Link>

      <PrimaryNav
        locale={locale}
        dict={dict}
        className={styles.nav}
        linkClassName={`${styles.link} label`}
      />

      <div className={styles.controls}>
        <LocaleNav current={locale} groupLabel={dict.localeGroup} names={localeNames} />
      </div>

      {/* Sotto il breakpoint il selettore lingua vive qui: nome e lingua su una
          riga sola sfondavano il viewport, e comprimerli avrebbe reso le aree
          di tocco piu piccole del minimo di 44px. */}
      <div className={styles.menu}>
        <MobileMenu locale={locale} dict={dict} localeNames={localeNames} />
      </div>
    </header>
  )
}
