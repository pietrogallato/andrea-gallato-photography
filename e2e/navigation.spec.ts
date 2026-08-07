import { test, expect } from '@playwright/test'

test('la radice reindirizza alla home italiana', async ({ page }) => {
  const response = await page.goto('/')
  expect(page.url()).toContain('/it')
  expect(response?.status()).toBe(200)
})

test('la home italiana dichiara lang="it"', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
})

test('la home inglese dichiara lang="en"', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il selettore lingua porta alla pagina equivalente', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il nome canonico interno restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/gallery')
  expect(response?.status()).toBe(404)
})

test('il segmento della lingua sbagliata restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/photographs')
  expect(response?.status()).toBe(404)
})

test('un locale non supportato restituisce 404', async ({ page }) => {
  const response = await page.goto('/fr')
  expect(response?.status()).toBe(404)
})

test('gli href del selettore lingua sono corretti nell HTML senza JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/it')

  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en')
  await context.close()
})

test('lo skip link diventa visibile al primo Tab e porta al contenuto', async ({
  page,
  browserName,
}) => {
  // WebKit salta gli <a> nella tabulazione: e il comportamento predefinito di
  // Safari, che evidenzia solo i controlli di form finche l utente non attiva
  // "Premi Tab per evidenziare ogni elemento". Verificato con un esperimento di
  // controllo su una pagina HTML nuda: in WebKit l ordine di tabulazione di
  // due link e un pulsante e ["button"], non ["a","a","button"].
  // Il test verifica la nostra implementazione, non la preferenza di Safari.
  test.skip(browserName === 'webkit', 'WebKit non tabula sui link per impostazione predefinita')

  await page.goto('/it')
  await page.keyboard.press('Tab')

  const skip = page.getByRole('link', { name: 'Vai al contenuto' })
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page).toHaveURL(/#main$/)
})
