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
    <nav aria-label={groupLabel} className={styles.switcher} data-current={current}>
      {LOCALES.map((locale) => {
        const isCurrent = locale === current

        return (
          <Link
            key={locale}
            href={paths[locale]}
            className={styles.link}
            data-current={isCurrent || undefined}
            // Visibile il codice, accessibile il nome per esteso. "IT" e
            // contenuto in "ITALIANO", quindi l etichetta visibile fa parte del
            // nome accessibile e WCAG 2.5.3 Label in Name e rispettato.
            aria-label={names[locale]}
            {...(isCurrent
              ? { 'aria-current': 'true' as const }
              : { lang: locale, hrefLang: locale })}
          >
            {locale.toUpperCase()}
          </Link>
        )
      })}

      {/* Indicatore che scorre fra i due codici. E un solo elemento mosso da
          una trasformazione, non due stati accesi e spenti: il movimento e
          continuo e non fa sfarfallare nulla. */}
      <span className={styles.indicator} aria-hidden="true" />
    </nav>
  )
}
