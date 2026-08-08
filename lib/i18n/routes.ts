import { LOCALES, type Locale } from './locales'

export const ROUTES = {
  home: { it: [], en: [] },
  gallery: { it: ['fotografie'], en: ['photographs'] },
  projects: { it: ['progetti'], en: ['projects'] },
  about: { it: ['about'], en: ['about'] },
} as const satisfies Record<string, Record<Locale, readonly string[]>>

export type StaticRouteKey = keyof typeof ROUTES

export type Resolved =
  | { key: StaticRouteKey }
  | { key: 'project'; slug: string }

export function resolveRoute(locale: Locale, segments: readonly string[] = []): Resolved | null {
  if (segments.length === 0) return { key: 'home' }

  if (segments.length === 1) {
    for (const key of Object.keys(ROUTES) as StaticRouteKey[]) {
      const expected = ROUTES[key][locale]
      if (expected.length === 1 && expected[0] === segments[0]) return { key }
    }
    return null
  }

  if (segments.length === 2 && segments[0] === ROUTES.projects[locale][0]) {
    const slug = segments[1]
    return slug ? { key: 'project', slug } : null
  }

  return null
}

export function pathFor(locale: Locale, resolved: Resolved): string {
  const segments =
    resolved.key === 'project'
      ? [...ROUTES.projects[locale], resolved.slug]
      : [...ROUTES[resolved.key][locale]]

  return ['', locale, ...segments].join('/')
}

export function alternatePaths(resolved: Resolved): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, pathFor(locale, resolved)]),
  ) as Record<Locale, string>
}

/**
 * Percorsi equivalenti nelle due lingue a partire da un percorso pubblico.
 *
 * Serve al selettore lingua, che deve portare alla pagina corrispondente e non
 * alla home (specifica di prodotto 6). Ricade sulla home quando il percorso
 * non risolve: una lingua non supportata, un segmento inesistente o la radice.
 */
export function alternatePathsForPathname(pathname: string): Record<Locale, string> {
  const [, maybeLocale = '', ...rest] = pathname.split('/')
  if (!LOCALES.includes(maybeLocale as Locale)) return alternatePaths({ key: 'home' })

  const resolved = resolveRoute(maybeLocale as Locale, rest.filter(Boolean))
  return alternatePaths(resolved ?? { key: 'home' })
}
