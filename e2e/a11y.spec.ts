import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = ['/it', '/en', '/it/fotografie', '/en/photographs']
const THEMES = ['dark', 'light'] as const

for (const path of PAGES) {
  for (const theme of THEMES) {
    test(`nessuna violazione axe su ${path} in tema ${theme}`, async ({ page }) => {
      await page.goto(path)

      if (theme === 'light') {
        await page.getByRole('button', { name: /Tema chiaro|Light theme/ }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      }

      // I token dichiarano una transizione di 120ms sul colore. Senza questa
      // riga axe puo campionare a meta transizione e leggere il colore del
      // tema precedente contro lo sfondo di quello nuovo, riportando un
      // contrasto che nessun utente vede mai in stato stabile.
      // Non allenta il controllo: axe misura lo stato assestato, che e quello
      // che l utente vede dopo 120ms e per tutto il resto del tempo.
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      })

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}

test('nessuna violazione axe con la lightbox aperta', async ({ page }) => {
  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(results.violations).toEqual([])
})
