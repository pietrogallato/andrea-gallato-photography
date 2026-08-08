import type { MetadataRoute } from 'next'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { pathFor, type Resolved } from '@/lib/i18n/routes'

type RawProject = { slug?: string | null; _updatedAt?: string | null }

/**
 * Voci di sitemap per tutte le pagine pubbliche, in entrambe le lingue.
 *
 * I percorsi vengono da `pathFor`, la stessa funzione che genera i
 * collegamenti e i canonical: una sitemap che diverge dai percorsi reali
 * dichiarerebbe ai motori URL che restituiscono 404.
 */
export function buildSitemapEntries({
  siteUrl,
  projects,
  fallbackDate,
}: {
  siteUrl: string
  projects: RawProject[]
  fallbackDate?: string | null
}): MetadataRoute.Sitemap {
  const fallback = fallbackDate ? new Date(fallbackDate) : new Date()

  const rotte: Resolved[] = [
    { key: 'home' },
    { key: 'gallery' },
    { key: 'projects' },
    { key: 'about' },
  ]

  const voce = (route: Resolved, lastModified: Date) =>
    LOCALES.map((locale) => ({
      url: `${siteUrl}${pathFor(locale, route)}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${siteUrl}${pathFor(l, route)}`]),
        ) as Record<Locale, string>,
      },
    }))

  return [
    ...rotte.flatMap((route) => voce(route, fallback)),
    // Un progetto senza slug non ha una pagina: dichiararlo sarebbe un 404
    // annunciato ai motori di ricerca.
    ...projects
      .filter((p): p is RawProject & { slug: string } => Boolean(p.slug))
      .flatMap((p) =>
        voce({ key: 'project', slug: p.slug }, p._updatedAt ? new Date(p._updatedAt) : fallback),
      ),
  ]
}
