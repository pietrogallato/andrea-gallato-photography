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
