import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import styles from './BarraAnteprima.module.css'

/**
 * Dice che si stanno guardando le bozze, e come uscirne.
 *
 * Senza, l'anteprima e indistinguibile dal sito pubblico: si finirebbe per
 * credere pubblicato cio che non lo e — l'errore piu facile e piu costoso di
 * una modalita anteprima.
 */
export function BarraAnteprima({
  locale,
  percorsoPubblico,
}: {
  locale: Locale
  percorsoPubblico: string
}) {
  const dict = getDictionary(locale)

  const uscita = `/api/preview/disable?locale=${locale}`

  return (
    <div className={styles.barra} role="status">
      <span>{dict.previewAttiva}</span>
      <Link href={uscita} prefetch={false} className={styles.esci}>
        {dict.previewEsci}
      </Link>
      <Link href={percorsoPubblico} prefetch={false} className={styles.pubblica}>
        {dict.previewVaiAlSito}
      </Link>
    </div>
  )
}
