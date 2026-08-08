import { test, expect } from '@playwright/test'

test('ogni pagina dichiara canonical assoluto e due hreflang', async ({ page }) => {
  await page.goto('/it/progetti/nebbia')

  const canonical = page.locator('link[rel="canonical"]')
  await expect(canonical).toHaveAttribute('href', /^https?:\/\/.+\/it\/progetti\/nebbia$/)

  await expect(page.locator('link[rel="alternate"][hreflang="it"]')).toHaveAttribute(
    'href', /\/it\/progetti\/nebbia$/,
  )
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href', /\/en\/projects\/nebbia$/,
  )
})

test('l immagine social fissa il formato invece di negoziarlo', async ({ page }) => {
  await page.goto('/it')
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')

  // Formato fissato per determinismo, non per un guasto osservato: misurato
  // che auto=format oggi restituirebbe comunque JPEG agli scraper.
  expect(og).toContain('fm=jpg')
  expect(og).not.toContain('auto=format')
})

test('la sitemap elenca le pagine pubbliche con le lingue alternative', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)

  const xml = await res.text()
  for (const p of ['/it', '/en', '/it/fotografie', '/en/photographs', '/it/progetti', '/en/projects', '/it/about', '/en/about']) {
    expect(xml).toContain(`${p}<`)
  }
  expect(xml).toContain('/it/progetti/nebbia<')
  expect(xml).toContain('hreflang="en"')
})

test('robots esclude lo Studio e le API e indica la sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt')
  const testo = await res.text()

  expect(testo).toContain('Disallow: /studio')
  expect(testo).toContain('Disallow: /api/')
  expect(testo).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/)
})

test('l endpoint di revalidation rifiuta le richieste non firmate', async ({ request }) => {
  const res = await request.post('/api/revalidate', {
    data: { _type: 'photo', _id: 'x' },
    failOnStatusCode: false,
  })
  expect(res.status()).toBe(401)
})
