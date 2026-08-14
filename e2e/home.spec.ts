import { test, expect } from './fixtures'

/**
 * La home e una sola schermata. Il criterio e misurabile: l altezza del
 * documento non supera quella della finestra.
 */
async function scorre(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )
}

test('la home non scorre su desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/it')
  expect(await scorre(page)).toBe(false)
})

test('la home non scorre su telefono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/it')
  expect(await scorre(page)).toBe(false)
})

/**
 * L eccezione, e il motivo per cui esiste questo test: su uno schermo troppo
 * basso il contenuto non ci sta. La pagina deve **scorrere**, non tagliare:
 * WCAG 1.4.4 chiede che il testo possa raddoppiare senza perdere contenuto.
 * Senza questo test, un `overflow: hidden` farebbe passare gli altri due.
 */
test('su uno schermo basso la home scorre invece di tagliare', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 340 })
  await page.goto('/it')

  expect(await scorre(page)).toBe(true)

  // L introduzione resta raggiungibile: e cio che si sarebbe perso tagliando.
  const intro = page.getByTestId('home-intro')
  await intro.scrollIntoViewIfNeeded()
  await expect(intro).toBeVisible()
})

test('il footer non e nella home ed e nelle altre pagine', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('footer')).toHaveCount(0)

  for (const percorso of ['/it/fotografie', '/it/progetti', '/it/about']) {
    await page.goto(percorso)
    await expect(page.locator('footer')).toHaveCount(1)
  }
})

test('l invito porta alla galleria, con l etichetta della lingua', async ({ page }) => {
  await page.goto('/it')
  const it = page.getByRole('link', { name: 'Guarda le fotografie' })
  await expect(it).toHaveAttribute('href', '/it/fotografie')

  await page.goto('/en')
  const en = page.getByRole('link', { name: 'See the photographs' })
  await expect(en).toHaveAttribute('href', '/en/photographs')
})

test('l invito e raggiungibile e ha un area di tocco sufficiente', async ({ page }) => {
  await page.goto('/it')
  const invito = page.getByRole('link', { name: 'Guarda le fotografie' })
  await expect(invito).toBeVisible()

  const box = await invito.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)

  await invito.click()
  await expect(page).toHaveURL('/it/fotografie')
})
