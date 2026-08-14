import { test, expect } from './fixtures'

async function apriControlli(page: import('@playwright/test').Page, isMobile?: boolean) {
  if (!isMobile) return
  const trigger = page.getByRole('button', { name: /Apri il menu|Open menu/ })
  if (await trigger.isVisible().catch(() => false)) await trigger.click()
}

test('l indice elenca i progetti in entrambe le lingue', async ({ page }) => {
  await page.goto('/it/progetti')
  await expect(page.getByRole('link', { name: /Nebbia/ })).toBeVisible()

  await page.goto('/en/projects')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('link', { name: /Fog/ })).toBeVisible()
})

test('dall indice si apre la pagina del progetto', async ({ page }) => {
  await page.goto('/it/progetti')
  await page.getByRole('link', { name: /Nebbia/ }).click()

  await expect(page).toHaveURL('/it/progetti/nebbia')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nebbia')
})

test('la sequenza conserva l ordine editoriale', async ({ page }) => {
  await page.goto('/it/progetti/nebbia')

  // L ordine e quello scelto dall editor nell array photos, non
  // l ordinamento globale della galleria.
  const alt = await page.locator('main img').evaluateAll((imgs) =>
    imgs.map((i) => i.getAttribute('alt')),
  )
  expect(alt.length).toBe(7)
  expect(alt[0]).toContain('Placeholder 1')
})

test('la lightbox si apre da una pagina di progetto e restituisce il focus', async ({ page }) => {
  await page.goto('/it/progetti/nebbia')
  const terza = page.locator('main button').nth(2)

  await terza.click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(terza).toBeFocused()
})

test('uno slug inesistente restituisce 404, non una pagina vuota', async ({ page }) => {
  const res = await page.goto('/it/progetti/non-esiste')
  expect(res?.status()).toBe(404)
})

test('il selettore lingua resta sul progetto, conservando lo slug', async ({ page, isMobile }) => {
  await page.goto('/it/progetti/nebbia')
  await apriControlli(page, isMobile)
  await page.getByRole('link', { name: 'English' }).click()

  await expect(page).toHaveURL('/en/projects/nebbia')
})

test('la descrizione mancante ricade sull italiano ed e marcata', async ({ page }) => {
  await page.goto('/en/projects/citta')

  // citta non ha descriptionEn: WCAG 3.1.2 chiede che il testo in un altra
  // lingua sia dichiarato, altrimenti uno screen reader lo pronuncia con la
  // fonetica sbagliata.
  await expect(page.locator('main p[lang="it"]')).toBeVisible()
})
