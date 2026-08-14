import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { isLocale } from '@/lib/i18n/locales'
import { pathFor, resolveRoute } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'
import { HomeView } from '@/views/HomeView'
import { GalleryView } from '@/views/GalleryView'
import { AboutView } from '@/views/AboutView'
import { ProjectsView } from '@/views/ProjectsView'
import { ProjectView } from '@/views/ProjectView'
import { BarraAnteprima } from '@/components/preview/BarraAnteprima'

/**
 * L'anteprima, in un segmento **dichiaratamente dinamico**.
 *
 * Vive accanto alle pagine pubbliche invece che dentro: quelle restano
 * statiche e non sanno nulla delle bozze, mentre qui si legge `draftMode()`
 * senza che questo costi nulla a chi visita il sito.
 */
export const dynamic = 'force-dynamic'

/** Mai negli indici: sono contenuti non pubblicati. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PaginaAnteprima({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>
}) {
  const { locale, segments } = await params
  if (!isLocale(locale)) notFound()

  const route = resolveRoute(locale, segments ?? [])
  if (!route) notFound()

  const { isEnabled } = await draftMode()

  // Senza cookie non si vede nulla di riservato: si viene rimandati alla
  // pagina pubblica corrispondente. Un link di anteprima inoltrato per errore
  // porta al sito, non a un 403 che confermerebbe che qui c'e qualcosa.
  if (!isEnabled) redirect(pathFor(locale, route))

  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'], preview: true })
  const siteName = settings?.photographerName ?? 'Andrea Gallato'

  return (
    <>
      <BarraAnteprima locale={locale} percorsoPubblico={pathFor(locale, route)} />

      {route.key === 'home' ? <HomeView locale={locale} siteName={siteName} preview /> : null}
      {route.key === 'gallery' ? <GalleryView locale={locale} preview /> : null}
      {route.key === 'projects' ? <ProjectsView locale={locale} preview /> : null}
      {route.key === 'about' ? <AboutView locale={locale} siteName={siteName} preview /> : null}
      {route.key === 'project' ? (
        <ProjectView locale={locale} slug={route.slug} preview />
      ) : null}
    </>
  )
}
