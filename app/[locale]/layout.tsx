import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { THEME_SCRIPT, DEFAULT_THEME } from '@/lib/theme/script'
import { SkipLink } from '@/components/layout/SkipLink'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/typography.css'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
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

  return (
    <html lang={locale} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body>
        <SkipLink label={dict.skipToContent} />
        <Header locale={locale} siteName="Andrea Gallato" />
        <main id="main">{children}</main>
        <Footer locale={locale} siteName="Andrea Gallato" />
      </body>
    </html>
  )
}
