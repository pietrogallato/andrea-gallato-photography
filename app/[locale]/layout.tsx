import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, DEFAULT_LOCALE, isLocale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pickLocalized } from '@/lib/i18n/localize'
import { THEME_SCRIPT, DEFAULT_THEME } from '@/lib/theme/script'
import { display, sans } from '@/lib/fonts'
import { siteUrl } from '@/lib/siteUrl'
import { ThemeScript } from '@/components/theme/ThemeScript'
import { SkipLink } from '@/components/layout/SkipLink'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'

import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/typography.css'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })

  const name = settings?.photographerName ?? 'Andrea Gallato'
  const title = pickLocalized(
    { it: settings?.seoTitleIt, en: settings?.seoTitleEn },
    isLocale(locale) ? locale : DEFAULT_LOCALE,
  ).value

  const description = pickLocalized(
    { it: settings?.seoDescriptionIt, en: settings?.seoDescriptionEn },
    isLocale(locale) ? locale : DEFAULT_LOCALE,
  ).value

  return {
    metadataBase: new URL(siteUrl()),
    title: title || name,
    description: description || undefined,
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const settings = await sanityFetch({
    query: siteSettingsQuery,
    tags: ['settings'],
  })

  const siteName = settings?.photographerName ?? 'Andrea Gallato'

  return (
    <html
      lang={locale}
      data-theme={DEFAULT_THEME}
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript source={THEME_SCRIPT} />
      </head>
      <body>
        <SkipLink label={dict.skipToContent} />
        <Header locale={locale} siteName={siteName} />
        <main id="main">{children}</main>
        <Footer locale={locale} siteName={siteName} email={settings?.email ?? undefined} />
      </body>
    </html>
  )
}
