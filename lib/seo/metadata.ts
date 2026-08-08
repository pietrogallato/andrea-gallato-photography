import type { Metadata } from 'next'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { pathFor, type Resolved } from '@/lib/i18n/routes'
import { buildSocialImageUrl } from '@/lib/sanity/imageUrl'

const OG_LOCALE: Record<Locale, string> = { it: 'it_IT', en: 'en_US' }

/**
 * Metadati di una pagina pubblica.
 *
 * Canonical e hreflang si costruiscono da `pathFor`, la stessa funzione che
 * genera i collegamenti: non possono quindi divergere dai percorsi reali, che
 * e il modo piu comune in cui un hreflang smette di essere corretto.
 */
export function buildPageMetadata({
  siteUrl,
  siteName,
  socialImageUrl,
  locale,
  route,
  title,
  description,
}: {
  siteUrl: string
  siteName: string
  socialImageUrl?: string | null
  locale: Locale
  route: Resolved
  title: string
  description?: string | null
}): Metadata {
  const absolute = (l: Locale) => `${siteUrl}${pathFor(l, route)}`
  const cleanDescription = description?.trim() || undefined

  const images = socialImageUrl
    ? [{ url: buildSocialImageUrl(socialImageUrl), width: 1200, height: 630 }]
    : undefined

  return {
    title,
    description: cleanDescription,
    alternates: {
      canonical: absolute(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, absolute(l)])) as Record<Locale, string>,
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description: cleanDescription,
      url: absolute(locale),
      locale: OG_LOCALE[locale],
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description: cleanDescription,
    },
  }
}
