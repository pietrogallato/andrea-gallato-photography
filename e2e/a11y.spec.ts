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

/**
 * La superficie della lightbox spegne il gesto del browser — `touch-action:
 * none` — perche li la pizzicata e nostra. Quella deroga regge solo finche
 * l ingrandimento del browser resta disponibile su tutto il resto: WCAG 1.4.4
 * chiede che il testo si possa portare al 200%, e un `user-scalable=no` o un
 * `maximum-scale` sotto 2 lo toglierebbero a chi ci vede poco — inclusa la
 * didascalia della lightbox, che e proprio il testo piu piccolo del sito.
 *
 * Il meta oggi non lo scrive nessuno: e quello di ripiego di Next, `width=
 * device-width, initial-scale=1`. Basterebbe un `export const viewport` in un
 * layout per cambiarlo, e nulla lo direbbe.
 *
 * Un test a se e non solo le scansioni axe qui sopra, che pure lo coprono —
 * **verificato il 2026-08-17** iniettando i valori vietati nella pagina:
 * `user-scalable=no` e `maximum-scale=1` fanno comparire la violazione
 * `meta-viewport`, `maximum-scale=2` no. Ma quella copertura e implicita e non
 * si trova cercando: chi domani volesse aggiungere quel meta cerchera il suo
 * nome, non «axe».
 */
test('il meta viewport non toglie l ingrandimento del browser', async ({ page }) => {
  await page.goto('/it/fotografie')
  const contenuto = (await page.locator('meta[name=viewport]').getAttribute('content')) ?? ''

  expect(contenuto).not.toMatch(/user-scalable\s*=\s*(no|0)/i)
  const massimo = /maximum-scale\s*=\s*([\d.]+)/i.exec(contenuto)
  // Assente va benissimo: e il caso di oggi, e vuol dire nessun tetto.
  if (massimo) expect(Number(massimo[1])).toBeGreaterThanOrEqual(2)
})

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
