import {
  test as base,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

/**
 * Le fotografie arrivano da un fixture locale, non da cdn.sanity.io.
 *
 * Non e una comodita: e cio che toglie di mezzo un difetto misurato. Playwright
 * naviga con `waitUntil: 'load'`, e su WebKit l evento `load` non arriva finche
 * ogni immagine non si e risolta. Misurato il 9 agosto 2026 sulla pagina About:
 * con una sola richiesta al CDN lasciata in sospeso, WebKit resta a
 * `document.readyState === 'interactive'` per sempre e `page.goto` scade dopo i
 * 30 secondi del test; Chromium, sulla stessa pagina e con la stessa richiesta
 * in sospeso, emette `load` in 61ms. Da qui i due fatti riportati: falliscono
 * solo i progetti WebKit (`webkit` e `iphone`), e la vittima e la navigazione
 * che si trovava in volo in quel momento, non un test in particolare.
 *
 * Una richiesta che FALLISCE non fa danno — WebKit emette `load` lo stesso in
 * 59ms. Serve una richiesta che non si risolve ne in un verso ne nell altro:
 * misurando 6.723 richieste al CDN sotto il traffico della suite, tutte
 * tornavano 200 (nessun 429, nessuna limitazione osservata) con p50 15ms e p99
 * 170ms, ma con code isolate di 2,2s e 3,1s. Basta che una di quelle code si
 * allunghi perche un test qualunque scada.
 *
 * Servendo le fotografie da qui, nessuna navigazione della suite dipende piu da
 * un terzo. Che le URL vere del CDN si risolvano davvero resta verificato, ma
 * in un test solo e dichiarato: `e2e/cdn.spec.ts`.
 */
const FOTOGRAFIA = Buffer.from(
  '/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIAAf//Z',
  'base64',
)

/**
 * Le dimensioni intrinseche non contano: la galleria costruisce le righe con le
 * proporzioni che arrivano dal dataset e la lightbox dimensiona il riquadro in
 * CSS, quindi 8x8 pixel bastano perche l immagine si decodifichi.
 */
export async function serviFotografieLocali(target: BrowserContext | Page) {
  await target.route('**cdn.sanity.io**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTOGRAFIA }),
  )
}

/** Per i test che si costruiscono il contesto da soli (quelli senza JavaScript). */
export async function nuovoContesto(browser: Browser, options?: BrowserContextOptions) {
  const context = await browser.newContext(options)
  await serviFotografieLocali(context)
  return context
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await serviFotografieLocali(context)
    await use(context)
  },
})
