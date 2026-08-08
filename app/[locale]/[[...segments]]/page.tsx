import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { ROUTES, resolveRoute } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery, projectSlugsQuery } from '@/lib/sanity/queries'
import { HomeView } from '@/views/HomeView'
import { GalleryView } from '@/views/GalleryView'
import { AboutView } from '@/views/AboutView'
import { ProjectsView } from '@/views/ProjectsView'
import { ProjectView } from '@/views/ProjectView'

export async function generateStaticParams() {
  const slugs = await sanityFetch({ query: projectSlugsQuery, tags: ['projects-index'] })

  return LOCALES.flatMap((locale) => [
    { locale, segments: [] as string[] },
    { locale, segments: [...ROUTES.gallery[locale]] },
    { locale, segments: [...ROUTES.projects[locale]] },
    { locale, segments: [...ROUTES.about[locale]] },
    // dynamicParams resta al default: un progetto pubblicato dopo il build
    // viene generato su richiesta invece di dare 404 fino al deploy successivo.
    ...(slugs ?? []).map((slug) => ({
      locale,
      segments: [...ROUTES.projects[locale], slug],
    })),
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

    case 'projects':
      return <ProjectsView locale={locale} />

    case 'project':
      return <ProjectView locale={locale} slug={route.slug} />

    case 'about': {
      const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })
      return <AboutView locale={locale} siteName={settings?.photographerName ?? 'Andrea Gallato'} />
    }
    default:
      // projects, project e about arrivano in Fase 2.
      notFound()
  }
}
