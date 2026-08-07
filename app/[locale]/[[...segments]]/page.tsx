import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { ROUTES, resolveRoute } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { HomeView } from '@/views/HomeView'
import { GalleryView } from '@/views/GalleryView'

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => [
    { locale, segments: [] as string[] },
    { locale, segments: [...ROUTES.gallery[locale]] },
  ])
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>
}) {
  const { locale, segments } = await params
  if (!isLocale(locale)) notFound()

  const route = resolveRoute(locale, segments ?? [])
  if (!route) notFound()

  switch (route.key) {
    case 'home': {
      const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })
      return <HomeView locale={locale} siteName={settings?.photographerName ?? 'Andrea Gallato'} />
    }
    case 'gallery':
      return <GalleryView locale={locale} />
    default:
      // projects, project e about arrivano in Fase 2.
      notFound()
  }
}
