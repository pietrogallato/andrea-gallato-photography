import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

/**
 * Autenticazione dello Studio per gli end-to-end.
 *
 * Lo Studio si autentica con SSO: senza questo passaggio ogni test si
 * fermerebbe alla schermata «Choose login provider». Si inietta un token di
 * utente di servizio nella chiave di localStorage che lo Studio legge
 * all'avvio, e si salva lo stato per i test veri.
 *
 * Il token **non e versionato**: sta in `SANITY_E2E_AUTH_TOKEN`. Quando manca,
 * i progetti dello Studio non vengono nemmeno registrati — vedi
 * `playwright.config.ts` — perche una suite che fallisce per una credenziale
 * assente si impara a ignorarla, ed e il primo passo verso una suite che non
 * si guarda piu.
 */

export const STATO_AUTENTICATO = path.join(__dirname, '.auth', 'studio.json')

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''

setup('autentica lo Studio', async ({ page }) => {
  const token = process.env.SANITY_E2E_AUTH_TOKEN
  expect(token, 'SANITY_E2E_AUTH_TOKEN non valorizzata').toBeTruthy()

  // Serve una pagina della stessa origine prima di poter scrivere in
  // localStorage: su about:blank la scrittura verrebbe persa.
  await page.goto('/studio')

  await page.evaluate(
    ([chiave, valore]) => window.localStorage.setItem(chiave, valore),
    [`__sanity_auth_token_${PROJECT_ID}`, JSON.stringify({ token, time: new Date().toISOString() })],
  )

  await page.reload()

  // La prova che l'iniezione ha funzionato: la schermata di login non c'e piu.
  await expect(page.getByText('Choose login provider')).toBeHidden({ timeout: 30_000 })

  await page.context().storageState({ path: STATO_AUTENTICATO })
})
