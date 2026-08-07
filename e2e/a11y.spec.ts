import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = ['/it', '/en']
const THEMES = ['dark', 'light'] as const

for (const path of PAGES) {
  for (const theme of THEMES) {
    test(`nessuna violazione axe su ${path} in tema ${theme}`, async ({ page }) => {
      await page.goto(path)

      if (theme === 'light') {
        await page.getByRole('button', { name: /Tema chiaro|Light theme/ }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}
