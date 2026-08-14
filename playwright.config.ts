import { defineConfig, devices } from '@playwright/test'

/**
 * Due ambienti, non uno.
 *
 * I progetti browser girano contro un build di produzione, che e cio che vede
 * il visitatore e l unico posto dove esiste la Data Cache.
 *
 * Il progetto `dev` gira contro `next dev`, dove React monta due volte e
 * lascia attivi i propri avvisi. Due difetti reali si erano nascosti proprio
 * li: la lightbox che si richiudeva da sola per via del doppio montaggio, e lo
 * script del tema che faceva emettere un errore a ogni cambio di lingua. In
 * produzione nessuno dei due e osservabile, quindi la suite non li vedeva.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    // `on-first-retry` non registrava nulla: `retries` e zero, quindi un primo
    // tentativo fallito era anche l ultimo. Un timeout di rete lasciava dietro
    // di se solo "page.goto: Test timeout", senza dire quale richiesta fosse
    // rimasta appesa. `retain-on-failure` registra durante ogni test e tiene la
    // traccia solo di quelli falliti: al prossimo blocco la richiesta colpevole
    // e li dentro.
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /\.dev\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
    },
    {
      name: 'webkit',
      testIgnore: /\.dev\.spec\.ts$/,
      use: { ...devices['Desktop Safari'], baseURL: 'http://localhost:3000' },
    },
    {
      name: 'iphone',
      testIgnore: /\.dev\.spec\.ts$/,
      use: { ...devices['iPhone 14'], baseURL: 'http://localhost:3000' },
    },
    {
      name: 'dev',
      testMatch: /\.dev\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'next dev -p 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
