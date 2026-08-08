import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    // /studio e l interfaccia editoriale e /api non ha contenuto da indicizzare.
    rules: { userAgent: '*', allow: '/', disallow: ['/studio', '/api/'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
