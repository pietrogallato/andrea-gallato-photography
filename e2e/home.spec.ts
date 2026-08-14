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
 * L eccezione, e il motivo per cui questo test esiste: WCAG 1.4.4 chiede che
 * il testo possa raddoppiare senza perdere contenuto. Coi caratteri al 200%
 * il contenuto non ci sta piu, e la pagina deve **scorrere**, non tagliare.
 * Senza questo test, un `overflow: hidden` farebbe passare gli altri due.
 *
 * **Misurato il 14 agosto 2026.** Una prova basata sul solo schermo basso non
 * serviva: a 640x340, con l introduzione vera, il contenuto misura 212px e ci
 * sta comodamente — la soglia reale e a 211px di altezza, che nessun telefono
 * ha. E l ingrandimento del testo, non lo schermo piccolo, a mettere davvero
 * alla prova la regola.
 */
test('coi caratteri al 200% la home scorre invece di tagliare', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/it')

  // 32px su una radice da 16px: il raddoppio che le linee guida chiedono.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'
  })

  // `poll` e non un assert secco: il riflusso dopo il cambio di dimensione non
  // e istantaneo, e un confronto immediato misurerebbe il layout di prima.
  await expect.poll(() => scorre(page)).toBe(true)

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
