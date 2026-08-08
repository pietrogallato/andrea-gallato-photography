import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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


const PAGES = ['/it', '/en', '/it/fotografie', '/en/photographs', '/it/about', '/en/about', '/it/progetti', '/en/projects', '/it/progetti/nebbia']
const THEMES = ['dark', 'light'] as const

for (const path of PAGES) {
  for (const theme of THEMES) {
    test(`nessuna violazione axe su ${path} in tema ${theme}`, async ({ page, isMobile }) => {
      await page.goto(path)

      if (theme === 'light') {
        await apriControlli(page, isMobile)
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
