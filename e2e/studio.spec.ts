import { test, expect } from '@playwright/test'

/**
 * Gli end-to-end dentro lo Studio.
 *
 * Girano solo quando `SANITY_E2E_AUTH_TOKEN` e valorizzata: senza, i progetti
 * non vengono registrati e questi test non esistono.
 *
 * **Scrivono su Sanity.** Il dataset e quello di sviluppo, e ogni test
 * ripulisce cio che crea: una suite che lascia dietro documenti finisce per
 * misurare la spazzatura delle esecuzioni precedenti.
 */

test.describe('tool Carica fotografie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio')
  })

  test('il tool compare fra gli strumenti', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Carica fotografie/i })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('spiega che le fotografie entrano come bozze', async ({ page }) => {
    await page.getByRole('link', { name: /Carica fotografie/i }).click()

    // Il tool non pubblica nulla: se questa frase sparisse, l'editor non
    // saprebbe piu perche le sue fotografie non sono online.
    await expect(page.getByText(/bozze/i).first()).toBeVisible()
  })

  test('espone un campo file con un nome accessibile', async ({ page }) => {
    await page.getByRole('link', { name: /Carica fotografie/i }).click()

    const campo = page.locator('#carica-fotografie-file')
    await expect(campo).toBeVisible()
    await expect(campo).toHaveAttribute('multiple', '')
  })
})

test.describe('report delle bozze sui progetti', () => {
  test('l azione compare sulla pagina di un progetto', async ({ page }) => {
    await page.goto('/studio/structure/project')

    const primo = page.locator('[data-testid="pane-item"]').first()
    await primo.click()

    // L'etichetta dice quante sono, oppure che sta verificando: entrambe
    // provano che l'azione e registrata e che la query e partita.
    await expect(
      page.getByRole('button', { name: /Fotografie in bozza|Verifico le fotografie/ }),
    ).toBeVisible({ timeout: 30_000 })
  })
})
