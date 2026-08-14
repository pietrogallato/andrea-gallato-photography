import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    // /studio e l interfaccia editoriale, /api non ha contenuto da indicizzare
    // e sotto /preview ci sono bozze. L anteprima rimanda comunque alla pagina
    // pubblica a chi non ha il cookie, e dichiara noindex per conto suo:
    // questa riga e la terza rete, non l unica.
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio', '/api/', '/it/preview', '/en/preview'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
