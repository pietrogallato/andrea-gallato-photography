'use client'

import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/i18n/locales'
import { alternatePathsForPathname } from '@/lib/i18n/routes'
import { LocaleSwitcher } from './LocaleSwitcher'

/**
 * Selettore lingua agganciato alla pagina corrente.
 *
 * Il design vietava `usePathname` qui, ma per una ragione che non vale piu:
 * con i rewrite del middleware il percorso letto sul client differiva da
 * quello reso sul server, producendo href sbagliati e un errore di
 * idratazione. Quell architettura e stata abbandonata in favore della
 * catch-all, quindi il percorso e ora quello pubblico vero e coincide fra
 * server e client. Essendo reso anche in SSR, gli href sono corretti
 * nell HTML iniziale e funzionano senza JavaScript.
 *
 * L header vive nel layout, che non riceve i segmenti della pagina figlia:
 * senza questo componente il selettore riporterebbe sempre alla home,
 * contro la specifica di prodotto 6.
 */
export function LocaleNav({
  current,
  groupLabel,
  names,
}: {
  current: Locale
  groupLabel: string
  names: Record<Locale, string>
}) {
  const paths = alternatePathsForPathname(usePathname() ?? '/')

  return (
    <LocaleSwitcher current={current} paths={paths} groupLabel={groupLabel} names={names} />
  )
}
