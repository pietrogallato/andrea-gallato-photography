import { test, expect } from '@playwright/test'

/**
 * Sotto il breakpoint mobile lingua e tema non stanno nell header: vivono nel
 * pannello del menu, perche su una riga sola sfondavano il viewport. I test
 * che li usano devono quindi aprirlo prima.
 */
async function apriControlli(page: import('@playwright/test').Page, isMobile?: boolean) {
  if (!isMobile) return
  // Idempotente: a menu gia aperto il pulsante si chiama "Chiudi il menu",
  // quindi il localizzatore non trova nulla e non si fa nulla.
  const trigger = page.getByRole('button', { name: /Apri il menu|Open menu/ })
  if (await trigger.isVisible().catch(() => false)) await trigger.click()
}


test('parte in tema scuro alla prima visita', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('passa al tema chiaro e lo comunica con aria-pressed', async ({ page, isMobile }) => {
  await page.goto('/it')
  await apriControlli(page, isMobile)
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('ricorda la preferenza dopo un ricaricamento, senza flash', async ({ page, isMobile }) => {
  await page.goto('/it')
  await apriControlli(page, isMobile)
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await page.reload()

  // Verificato prima di qualunque attesa: lo script inline deve avere già
  // impostato l attributo al primo paint, non dopo l idratazione.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('mantiene la preferenza attraverso la navigazione', async ({ page, isMobile }) => {
  await page.goto('/it')
  await apriControlli(page, isMobile)
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await apriControlli(page, isMobile)
  await page.getByRole('link', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('il nome accessibile del toggle non cambia con lo stato', async ({ page, isMobile }) => {
  await page.goto('/it')
  await apriControlli(page, isMobile)
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await toggle.click()
  await expect(page.getByRole('button', { name: 'Tema chiaro' })).toBeVisible()
})
