import type { MetadataRoute } from 'next'
import { sanityFetch } from '@/lib/sanity/fetch'
import { sitemapQuery } from '@/lib/sanity/queries'
import { buildSitemapEntries } from '@/lib/seo/sitemapEntries'
import { siteUrl } from '@/lib/siteUrl'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await sanityFetch({ query: sitemapQuery, tags: ['sitemap', 'projects-index'] })

  return buildSitemapEntries({
    siteUrl: siteUrl(),
    projects: data?.projects ?? [],
    fallbackDate: data?.settingsUpdatedAt,
  })
}
