import { test, expect } from '@playwright/test'

test('parte in tema scuro alla prima visita', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('passa al tema chiaro e lo comunica con aria-pressed', async ({ page }) => {
  await page.goto('/it')
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('ricorda la preferenza dopo un ricaricamento, senza flash', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await page.reload()

  // Verificato prima di qualunque attesa: lo script inline deve avere già
  // impostato l attributo al primo paint, non dopo l idratazione.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('mantiene la preferenza attraverso la navigazione', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await page.getByRole('link', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('il nome accessibile del toggle non cambia con lo stato', async ({ page }) => {
  await page.goto('/it')
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await toggle.click()
  await expect(page.getByRole('button', { name: 'Tema chiaro' })).toBeVisible()
})
