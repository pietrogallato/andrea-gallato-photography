import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { resolveRoute } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { HomeView } from '@/views/HomeView'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, segments: [] as string[] }))
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
    default:
      // gallery, projects, project e about arrivano nei piani 1B e Fase 2.
      notFound()
  }
}
