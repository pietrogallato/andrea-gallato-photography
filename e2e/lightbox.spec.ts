import { test, expect } from '@playwright/test'

async function openFirst(page: import('@playwright/test').Page) {
  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('si apre e si chiude con il pulsante', async ({ page }) => {
  await openFirst(page)
  await page.getByRole('button', { name: 'Chiudi' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('si chiude con Esc', async ({ page }) => {
  await openFirst(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('naviga con le frecce', async ({ page }) => {
  await openFirst(page)
  const first = await page.getByRole('dialog').getAttribute('aria-label')

  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog')).not.toHaveAttribute('aria-label', first!)
})

test('rende inerte il contenuto sottostante', async ({ page }) => {
  await openFirst(page)

  // showModal() mette la dialog nel top layer: il contenuto esterno non
  // riceve il focus. Verificabile solo qui, non in jsdom.
  const headerFocusable = await page.locator('header a').first().evaluate((el) => {
    ;(el as HTMLElement).focus()
    return document.activeElement === el
  })

  expect(headerFocusable).toBe(false)
})

test('non lascia scorrere la pagina sotto e ripristina la posizione', async ({ page }) => {
  await page.goto('/it/fotografie')

  // Il tile va portato in vista PRIMA di leggere la posizione: cliccando,
  // Playwright lo scorrerebbe comunque in vista, cambiando lo scorrimento
  // dopo la misura. Un utente vero non provoca quel movimento.
  const tile = page.locator('[data-row] button').nth(8)
  await tile.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)

  await tile.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  expect(await page.evaluate(() => window.scrollY)).toBe(before)
})

test('restituisce il focus al tile di origine', async ({ page }) => {
  await page.goto('/it/fotografie')
  const tile = page.locator('[data-row] button').first()

  await tile.click()
  await page.keyboard.press('Escape')

  await expect(tile).toBeFocused()
})
