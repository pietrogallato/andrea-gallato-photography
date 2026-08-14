import { test, expect, type Page } from './fixtures'

/**
 * Questi test girano contro `next dev`, non contro il build di produzione.
 *
 * In sviluppo React monta due volte e lascia attivi i propri avvisi: e li che
 * vivono gli errori di idratazione, i doppi montaggi e i tag renderizzati in
 * modo scorretto. In produzione React elimina gli avvisi, quindi la suite
 * principale non puo vederli. Due difetti reali si erano nascosti proprio qui.
 */

/** Rumore dell ambiente di sviluppo, non del nostro codice. */
const IGNORATI = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /webpack-hmr|turbopack-hmr/i,
]

function raccogliProblemi(page: Page): string[] {
  const problemi: string[] = []

  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return
    const testo = m.text()
    if (IGNORATI.some((r) => r.test(testo))) return
    problemi.push(`[${m.type()}] ${testo}`)
  })

  page.on('pageerror', (e) => problemi.push(`[pageerror] ${e.message}`))

  return problemi
}

test('la home non produce errori di console', async ({ page }) => {
  const problemi = raccogliProblemi(page)

  await page.goto('/it')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForTimeout(800)

  expect(problemi).toEqual([])
})

test('il cambio di lingua non produce errori di console', async ({ page }) => {
  const problemi = raccogliProblemi(page)

  await page.goto('/it')
  await page.waitForTimeout(400)

  // Rimonta il layout radice, e con esso lo script del tema: e la navigazione
  // che faceva emettere "Encountered a script tag while rendering React
  // component" a ogni passaggio fra le due lingue.
  await page.getByRole('link', { name: 'English' }).click()
  await page.waitForURL('**/en')
  await page.waitForTimeout(800)

  expect(problemi).toEqual([])
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('la galleria e la lightbox non producono errori di console', async ({ page }) => {
  const problemi = raccogliProblemi(page)

  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Il doppio montaggio di sviluppo chiudeva la lightbox subito dopo averla
  // aperta: l attesa e piu lunga della finestra in cui accadeva.
  await page.waitForTimeout(1200)
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  expect(problemi).toEqual([])
})

test('il cambio di tema non produce errori di console', async ({ page }) => {
  const problemi = raccogliProblemi(page)

  await page.goto('/it')
  await page.getByRole('button', { name: 'Tema chiaro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await page.waitForTimeout(800)

  // Lo script inline modifica il DOM prima dell idratazione: senza
  // suppressHydrationWarning sull elemento html, React lo segnalerebbe qui.
  expect(problemi).toEqual([])
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
