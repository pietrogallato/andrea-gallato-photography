import Link from 'next/link'
import { Footer } from '@/components/layout/Footer'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'

export default async function NotFound() {
  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })

  return (
    <>
      <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-7) var(--space-4)' }}>
        <h1>404</h1>
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--fg-muted)' }}>
          Pagina non trovata — Page not found
        </p>
        <p style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/it">Torna alla home</Link>
          {' · '}
          <Link href="/en">Back to home</Link>
        </p>
      </div>

      <Footer siteName={settings?.photographerName ?? 'Andrea Gallato'} email={settings?.email ?? undefined} />
    </>
  )
}
