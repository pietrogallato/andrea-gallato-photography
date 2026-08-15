import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

const PAGES = ['/it', '/en', '/it/fotografie', '/en/photographs', '/it/about', '/en/about', '/it/progetti', '/en/projects', '/it/progetti/nebbia']
/**
 * Un tema solo. Prima ogni pagina veniva scansionata due volte, chiaro e
 * scuro; il tema chiaro non esiste piu e il ciclo con lui.
 */
for (const path of PAGES) {
  test(`nessuna violazione axe su ${path}`, async ({ page }) => {
    await page.goto(path)

    // I token dichiarano una transizione di 120ms sul colore. Senza questa
    // riga axe puo campionare a meta transizione e leggere un contrasto che
    // nessun utente vede mai in stato stabile. Non allenta il controllo: axe
    // misura lo stato assestato, che e quello che l utente vede sempre.
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
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
