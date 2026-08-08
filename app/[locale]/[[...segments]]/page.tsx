import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { ROUTES, resolveRoute } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery, projectSlugsQuery, projectBySlugQuery } from '@/lib/sanity/queries'
import { pickLocalized } from '@/lib/i18n/localize'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { siteUrl } from '@/lib/siteUrl'
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>
}): Promise<Metadata> {
  const { locale, segments } = await params
  if (!isLocale(locale)) return {}

  const route = resolveRoute(locale, segments ?? [])
  if (!route) return {}

  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })
  const dict = getDictionary(locale)

  const siteName = settings?.photographerName ?? 'Andrea Gallato'
  const seoTitle = pickLocalized({ it: settings?.seoTitleIt, en: settings?.seoTitleEn }, locale).value
  const seoDescription = pickLocalized(
    { it: settings?.seoDescriptionIt, en: settings?.seoDescriptionEn },
    locale,
  ).value

  // Il titolo dipende dalla pagina; la descrizione ricade su quella del sito
  // quando la pagina non ne ha una propria.
  let title = seoTitle || siteName
  let description = seoDescription

  if (route.key === 'gallery') title = `${dict.navGallery} — ${siteName}`
  if (route.key === 'projects') title = `${dict.navProjects} — ${siteName}`
  if (route.key === 'about') title = `${dict.navAbout} — ${siteName}`

  if (route.key === 'project') {
    const project = await sanityFetch({
      query: projectBySlugQuery,
      params: { slug: route.slug },
      tags: [`project:${route.slug}`],
    })

    // Un progetto inesistente non deve produrre metadati inventati: la pagina
    // restituira comunque 404.
    if (!project) return {}

    title = `${pickLocalized({ it: project.titleIt, en: project.titleEn }, locale).value} — ${siteName}`
    description =
      pickLocalized({ it: project.descriptionIt, en: project.descriptionEn }, locale).value ||
      seoDescription
  }

  return buildPageMetadata({
    siteUrl: siteUrl(),
    siteName,
    socialImageUrl: settings?.socialImageUrl,
    locale,
    route,
    title,
    description,
  })
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
      notFound()
  }
}
