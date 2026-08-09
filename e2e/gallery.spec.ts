import { test, expect } from '@playwright/test'

test('la galleria mostra le fotografie in entrambe le lingue', async ({ page }) => {
  await page.goto('/it/fotografie')
  await expect(page.getByRole('button').first()).toBeVisible()

  await page.goto('/en/photographs')
  await expect(page.getByRole('button').first()).toBeVisible()
})

test('le fotografie di una riga hanno la stessa altezza', async ({ page, isMobile }) => {
  // Sotto i 768px la galleria e a colonna singola per progetto: ogni riga
  // contiene una sola fotografia e l uniformita di altezza non si applica.
  test.skip(!!isMobile, 'layout a colonna singola sotto il breakpoint')

  await page.goto('/it/fotografie')

  const heights = await page.locator('[data-row]').first().locator('button').evaluateAll(
    (tiles) => tiles.map((t) => Math.round(t.getBoundingClientRect().height)),
  )

  expect(new Set(heights).size).toBe(1)
})

test('la pagina non scorre orizzontalmente', async ({ page }) => {
  await page.goto('/it/fotografie')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('l ultima riga non e stirata a tutta larghezza', async ({ page, isMobile }) => {
  // A colonna singola ogni tile occupa per progetto tutta la larghezza.
  test.skip(!!isMobile, 'layout a colonna singola sotto il breakpoint')

  await page.goto('/it/fotografie')

  const rows = page.locator('[data-row]')
  const count = await rows.count()
  const last = rows.nth(count - 1)

  const [rowWidth, tilesWidth] = await Promise.all([
    last.evaluate((el) => el.getBoundingClientRect().width),
    last.locator('button').evaluateAll((tiles) =>
      tiles.reduce((sum, t) => sum + t.getBoundingClientRect().width, 0),
    ),
  ])

  // Se l ultima riga fosse giustificata, i tile riempirebbero tutta la larghezza.
  if ((await last.locator('button').count()) < 2) return
  expect(tilesWidth).toBeLessThanOrEqual(rowWidth)
})

test('Carica altre aggiunge fotografie senza spostare quelle gia visibili', async ({ page }) => {
  await page.goto('/it/fotografie')

  const button = page.getByRole('button', { name: 'Carica altre' })
  if (!(await button.isVisible())) test.skip(true, 'meno di 24 fotografie nel dataset')

  const tiles = page.locator('[data-row] button')
  const before = await tiles.count()

  // Geometria assoluta rispetto al documento, non al viewport: per raggiungere
  // il pulsante in fondo Playwright deve scorrere di migliaia di pixel, quindi
  // una misura viewport-relative cambierebbe anche se nulla si e mosso.
  const absoluteBoxes = () =>
    tiles.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: Math.round(r.left + window.scrollX),
          y: Math.round(r.top + window.scrollY),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      }),
    )

  const boxesBefore = await absoluteBoxes()

  await button.click()
  await expect(tiles).not.toHaveCount(before)

  const boxesAfter = await absoluteBoxes()

  // Le fotografie gia visibili non si spostano ne cambiano dimensione: ogni
  // gruppo e un blocco di righe indipendente, quindi l append non rigiustifica
  // l ultima riga gia resa (design 7.1).
  expect(boxesAfter.slice(0, before)).toEqual(boxesBefore)
})

/**
 * Regressione riportata dall utente: navigando nella lightbox, se la
 * fotografia nuova tardava, restava a schermo quella precedente invece di un
 * segnale di attesa.
 *
 * La causa non era nostra logica ma il browser: React riusava lo stesso <img>
 * cambiandogli `src`, e un <img> continua a dipingere i pixel vecchi finche i
 * nuovi non sono decodificati. Per questo il test vive qui e non fra gli unit
 * test: in jsdom non si dipinge nulla e il difetto sparisce.
 */
test('cambiando fotografia l elemento immagine viene sostituito, non riscritto', async ({ page }) => {
  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const primaImmagine = await dialog.locator('img').elementHandle()
  await dialog.getByRole('button', { name: 'Fotografia successiva' }).click()

  // L elemento che portava la fotografia precedente esce dal documento: e la
  // prova che quei pixel non possono piu restare a schermo. Col difetto
  // restava lo stesso nodo col solo `src` riscritto, e questa asserzione
  // falliva — indipendentemente dalla velocita della rete, quindi vale su
  // ogni dispositivo.
  await expect
    .poll(() => primaImmagine!.evaluate((el) => el.isConnected), { timeout: 5_000 })
    .toBe(false)
})

test('quando la fotografia tarda, l attesa e dichiarata', async ({ page, isMobile }) => {
  // **Misurato il 9 agosto 2026:** con il layout a colonna singola il tile ha
  // gia la larghezza del viewport, quindi la lightbox riusa lo stesso
  // candidato di srcset e la navigazione fa ZERO richieste al CDN (contro 1
  // su desktop). Non c e nulla da attendere, e nulla da intercettare: il
  // rallentamento non avrebbe presa e l indicatore giustamente non compare.
  test.skip(!!isMobile, 'a colonna singola la fotografia e gia in cache dal tile')

  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Il rallentamento si installa solo ora: applicato prima renderebbe lento
  // anche il caricamento della galleria, senza aggiungere nulla.
  await page.route('**cdn.sanity.io**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })

  await dialog.getByRole('button', { name: 'Fotografia successiva' }).click()

  // Al posto della fotografia precedente c e un segnale di attesa, non il vuoto.
  await expect(dialog.getByRole('progressbar')).toBeVisible()

  // Quando la fotografia arriva, l attesa si toglie di mezzo.
  await expect(dialog.getByRole('progressbar')).toBeHidden({ timeout: 10_000 })
})

test('una fotografia gia in cache non fa lampeggiare l attesa', async ({ page }) => {
  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Avanti e indietro: la prima fotografia e gia stata scaricata.
  await dialog.getByRole('button', { name: 'Fotografia successiva' }).click()
  await expect(dialog.getByRole('progressbar')).toBeHidden({ timeout: 10_000 })
  await dialog.getByRole('button', { name: 'Fotografia precedente' }).click()

  // Sotto la soglia l indicatore non deve comparire affatto.
  await page.waitForTimeout(250)
  await expect(dialog.getByRole('progressbar')).toBeHidden()
})
