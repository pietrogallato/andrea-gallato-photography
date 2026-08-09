'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { pathFor, type StaticRouteKey } from '@/lib/i18n/routes'

/**
 * Le tre voci di navigazione, in un posto solo.
 *
 * Erano scritte due volte, nell header e nel pannello del menu: aggiungerne
 * una quarta avrebbe voluto dire ricordarsi di entrambi.
 *
 * Il percorso si legge dal client per la stessa ragione di `LocaleNav`:
 * l header vive nel layout, che non riceve i segmenti della pagina figlia.
 * Con la catch-all il percorso pubblico coincide fra server e client, quindi
 * `aria-current` e corretto gia nell HTML iniziale e non serve JavaScript
 * perche i collegamenti funzionino.
 */
const VOCI = [
  { key: 'gallery', label: (d: Dictionary) => d.navGallery },
  { key: 'projects', label: (d: Dictionary) => d.navProjects },
  { key: 'about', label: (d: Dictionary) => d.navAbout },
] as const satisfies ReadonlyArray<{ key: StaticRouteKey; label: (d: Dictionary) => string }>

export function PrimaryNav({
  locale,
  dict,
  className,
  linkClassName,
  onNavigate,
}: {
  locale: Locale
  dict: Dictionary
  className?: string
  linkClassName?: string
  /** Il pannello del menu si chiude quando si sceglie una voce. */
  onNavigate?: () => void
}) {
  const pathname = usePathname() ?? '/'

  return (
    <nav aria-label={dict.navPrimary} className={className}>
      {VOCI.map((voce) => {
        const href = pathFor(locale, { key: voce.key })
        // La pagina di un progetto sta sotto Progetti: la voce resta accesa
        // anche li, altrimenti navigando dentro un progetto si perde il segno.
        const corrente = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={voce.key}
            href={href}
            className={linkClassName}
            aria-current={corrente ? 'page' : undefined}
            onClick={onNavigate}
          >
            {voce.label(dict)}
          </Link>
        )
      })}
    </nav>
  )
}
