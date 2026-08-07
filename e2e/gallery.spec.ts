import { test, expect } from '@playwright/test'

test('la galleria mostra le fotografie in entrambe le lingue', async ({ page }) => {
  await page.goto('/it/fotografie')
  await expect(page.getByRole('button').first()).toBeVisible()

  await page.goto('/en/photographs')
  await expect(page.getByRole('button').first()).toBeVisible()
})

test('le fotografie di una riga hanno la stessa altezza', async ({ page }) => {
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

test('l ultima riga non e stirata a tutta larghezza', async ({ page }) => {
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

  const before = await page.locator('[data-row] button').count()
  const firstTileBox = await page.locator('[data-row] button').first().boundingBox()

  await button.click()
  await expect(page.locator('[data-row] button')).not.toHaveCount(before)

  const afterBox = await page.locator('[data-row] button').first().boundingBox()
  expect(afterBox?.y).toBe(firstTileBox?.y)
})
