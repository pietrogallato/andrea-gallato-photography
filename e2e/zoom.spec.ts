import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

async function apriPrima(page: import('@playwright/test').Page) {
  await page.goto('/it/fotografie')
  await page.locator('main img').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Il livello vive in una variabile CSS sulla superficie: e la fonte piu diretta. */
async function livello(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const s = document.querySelector('dialog figure > div') as HTMLElement
    return Number(getComputedStyle(s).getPropertyValue('--zoom'))
  })
}

test('il pulsante ingrandisce, e a riposo non c e quello per tornare indietro', async ({ page }) => {
  await apriPrima(page)
  await expect(page.getByRole('button', { name: 'Torna a schermo intero' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  expect(await livello(page)).toBeGreaterThan(1)
  await expect(page.getByRole('button', { name: 'Torna a schermo intero' })).toBeVisible()
})

test('da ingranditi frecce e didascalia si ritirano', async ({ page }) => {
  await apriPrima(page)
  await expect(page.getByRole('button', { name: 'Fotografia successiva' })).toBeVisible()

  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  await expect(page.getByRole('button', { name: 'Fotografia successiva' })).toHaveCount(0)
})

test('i tasti + e 0 funzionano', async ({ page }) => {
  await apriPrima(page)
  await page.keyboard.press('+')
  expect(await livello(page)).toBeGreaterThan(1)

  await page.keyboard.press('0')
  expect(await livello(page)).toBe(1)
})

test('Ctrl e rotella ingrandiscono la fotografia', async ({ page, isMobile }) => {
  // Su un telefono la rotella non esiste, e Playwright lo dice esplicitamente:
  // sul progetto `iphone` la chiamata fallisce con «mouse.wheel: Mouse wheel is
  // not supported in mobile WebKit». Non e un difetto nostro — su webkit da
  // scrivania lo stesso test passa. Li il gesto equivalente e la pizzicata, che
  // resta fra le verifiche a mano in docs/verifiche.
  test.skip(!!isMobile, 'la rotella non esiste sul mobile, e Playwright non la emula')

  await apriPrima(page)
  const riquadro = await page.locator('dialog figure > div').boundingBox()
  await page.mouse.move(riquadro!.x + riquadro!.width / 2, riquadro!.y + riquadro!.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -300)
  await page.keyboard.up('Control')

  expect(await livello(page)).toBeGreaterThan(1)
})

test('il doppio clic fa da interruttore', async ({ page }) => {
  await apriPrima(page)
  const riquadro = page.locator('dialog figure > div')

  await riquadro.dblclick()
  expect(await livello(page)).toBeCloseTo(2, 1)

  await riquadro.dblclick()
  expect(await livello(page)).toBe(1)
})

test('Esc a due tempi: prima torna a schermo intero, poi chiude', async ({ page }) => {
  await apriPrima(page)
  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await livello(page)).toBe(1)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('ingrandendo si chiede un gradino piu grande alla CDN', async ({ page }) => {
  // Il fixture serve un JPEG 8x8 per ogni richiesta al CDN, quindi naturalWidth
  // vale 8 e non dimostra nulla: la prova sta nel parametro `w=` richiesto,
  // che il fixture lascia intatto.
  const larghezze: number[] = []
  page.on('request', (req) => {
    const w = new URL(req.url()).searchParams.get('w')
    if (req.url().includes('cdn.sanity.io') && w) larghezze.push(Number(w))
  })

  await apriPrima(page)
  await page.waitForTimeout(1000)
  const primaDelloZoom = Math.max(...larghezze)

  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()
  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()
  await page.waitForTimeout(2000)

  expect(Math.max(...larghezze)).toBeGreaterThan(primaDelloZoom)
})

/**
 * Al tetto il comando per ingrandire resta focalizzabile, ed e una scelta: un
 * `disabled` vero butterebbe sul body il fuoco di chi lo sta premendo da
 * tastiera. Ma allora non lo si puo spegnere con `opacity` sull elemento
 * intero, perche quell opacita smorza anche il contorno del fuoco: al 20%
 * sopra lo sfondo del dialog il contorno #7fb2ff diventa rgb(32,42,59), cioe
 * 1,4:1 di contrasto, contro i 3:1 che WCAG 1.4.11 chiede a un indicatore di
 * fuoco. Chi naviga da tastiera arriverebbe qui e non vedrebbe piu dov e.
 * Lo stato spento si dice con il colore; il contorno resta pieno.
 *
 * Axe non lo coglie: non valuta il contrasto degli indicatori di fuoco.
 */
test('al tetto il comando spento non smorza il contorno del fuoco', async ({ page }) => {
  await apriPrima(page)
  const ingrandisci = page.getByRole('button', { name: 'Ingrandisci la fotografia' })

  // Il livello si ferma al tetto da solo: otto colpi lo superano su qualunque
  // fotografia del dataset.
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('+')
  await expect(ingrandisci).toHaveAttribute('aria-disabled', 'true')

  await expect(ingrandisci).toHaveCSS('opacity', '1')
  // E resta spento a vedersi: il colore lo dice, altrimenti la correzione
  // avrebbe solo riacceso un comando che non funziona.
  const spento = await ingrandisci.evaluate((el) => getComputedStyle(el).color)
  const acceso = await page
    .getByRole('button', { name: 'Riduci la fotografia' })
    .evaluate((el) => getComputedStyle(el).color)
  expect(spento).not.toBe(acceso)
})

/**
 * Il punto di tutta la modifica, in un test solo.
 *
 * Prima, ingrandire moltiplicava i pixel dentro una finestra che non cresceva
 * mai: su uno schermo 1440x900 la superficie restava 702x702 — il 38% — sia a
 * riposo sia al massimo dell ingrandimento. Ora quella finestra, quando si
 * ingrandisce, diventa lo schermo.
 *
 * Si misura il rettangolo e non la classe CSS: una regola puo esserci ed
 * essere scavalcata, e allora il test direbbe di si mentre l utente vede di no.
 */
test('ingrandendo, la cornice che ritaglia diventa il viewport', async ({ page }) => {
  await apriPrima(page)
  const superficie = page.locator('dialog figure > div')
  const schermo = page.viewportSize()!

  const riposo = (await superficie.boundingBox())!
  expect(riposo.width).toBeLessThan(schermo.width)
  expect(riposo.height).toBeLessThan(schermo.height)

  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  const ingrandita = (await superficie.boundingBox())!
  // Tolleranza di un pixel: le altezze in dvh arrivano con dei decimali, e un
  // arrotondamento non e la differenza che questo test vuole cogliere.
  expect(Math.abs(ingrandita.width - schermo.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(ingrandita.height - schermo.height)).toBeLessThanOrEqual(1)
  expect(ingrandita.x).toBeLessThanOrEqual(1)
  expect(ingrandita.y).toBeLessThanOrEqual(1)
})

/**
 * Espandendo la cornice, la fotografia si dipinge da subito piu grande: il
 * tetto in cifre deve scendere, perche si parte da piu vicino ai pixel veri
 * del file. Se non si ricalcolasse, resterebbe quello misurato a riposo e si
 * ingrandirebbe oltre i pixel disponibili, cioe fino a vedere la sgranatura.
 */
test('espandendo la cornice il tetto si ricalcola', async ({ page }) => {
  await apriPrima(page)

  // Al tetto da riposo: il livello si ferma da solo, e il comando si spegne.
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('+')
  await expect(page.getByRole('button', { name: 'Ingrandisci la fotografia' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  const tettoDopoLEspansione = await livello(page)

  // Quanto grande e la fotografia adesso, in pixel CSS: il prodotto fra il
  // livello e la larghezza dipinta e il punto d arrivo, e non deve dipendere
  // da quale delle due cornici si stia misurando.
  const dipinta = await page.evaluate(() => {
    const foto = document.querySelector('dialog figure > div > div') as HTMLElement
    return foto.getBoundingClientRect().width
  })
  const arrivo = tettoDopoLEspansione * dipinta

  await page.keyboard.press('0')
  const aRiposo = await page.evaluate(() => {
    const foto = document.querySelector('dialog figure > div > div') as HTMLElement
    return foto.getBoundingClientRect().width
  })

  // A riposo si parte da piu lontano, quindi lo stesso arrivo costa un tetto
  // piu alto: e la prova che il tetto non e rimasto quello di prima.
  expect(dipinta).toBeGreaterThan(aRiposo)
  expect(arrivo / aRiposo).toBeGreaterThan(tettoDopoLEspansione)
})

/**
 * Toglie la transizione sulla fotografia.
 *
 * Serve ai due test qui sotto, che misurano il rettangolo trasformato invece
 * di quello di una scatola ferma: durante i 120ms della transizione quel
 * rettangolo e a meta strada, e leggerlo darebbe un numero che non esiste in
 * nessuno stato stabile. Non allenta nulla — lo spostamento e lo stesso, ci si
 * arriva soltanto subito.
 */
async function senzaTransizione(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: 'dialog figure img { transition: none !important }' })
}

/** I bordi della fotografia dipinta, in coordinate dello schermo. */
async function bordiFotografia(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const r = (document.querySelector('dialog figure img') as HTMLElement).getBoundingClientRect()
    return { sinistro: r.left, destro: r.right, alto: r.top, basso: r.bottom }
  })
}

/**
 * L altra meta della cornice espansa, e quella che si sbaglia in silenzio.
 *
 * Espandendo il ritaglio fino allo schermo senza toccare il limite dello
 * spostamento, i due smettono di parlare della stessa cosa: il limite resta
 * calcolato sui bordi della fotografia mentre a ritagliare e ormai il viewport,
 * e la differenza — meta della distanza fra i due lati, per asse — e esattamente
 * quanto sfondo si riesce a trascinare in scena. **Misurato il 2026-08-17** a
 * 1440x900 prima del rimedio: al tetto, spinto il pan fino in fondo, restavano
 * 270px di nero fermo lungo il bordo, il 19% dello schermo.
 *
 * Si sceglie il tetto perche li la fotografia copre lo schermo a ogni viewport
 * della suite, telefono compreso: sotto, il nero attorno c e e deve restare
 * fermo, che e il caso dell altro test.
 */
test('spinto fino in fondo, lo spostamento non apre una fessura di sfondo', async ({ page }) => {
  await apriPrima(page)
  await senzaTransizione(page)
  const schermo = page.viewportSize()!

  for (let i = 0; i < 12; i += 1) await page.keyboard.press('+')
  await expect(page.getByRole('button', { name: 'Ingrandisci la fotografia' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  // Al tetto la fotografia copre lo schermo: e la premessa di tutto il resto.
  const centrata = await bordiFotografia(page)
  expect(centrata.destro - centrata.sinistro).toBeGreaterThanOrEqual(schermo.width)
  expect(centrata.basso - centrata.alto).toBeGreaterThanOrEqual(schermo.height)

  // Trenta passi da 60px sono 1800: piu del massimo a qualunque viewport.
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('ArrowLeft')
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('ArrowUp')

  // Il bordo si ferma esattamente sul bordo dello schermo: oltre sarebbe
  // spostamento sprecato, prima sarebbe la fessura. Un pixel di tolleranza per
  // gli arrotondamenti dei dvh.
  const spinta = await bordiFotografia(page)
  expect(Math.abs(spinta.sinistro)).toBeLessThanOrEqual(1)
  expect(Math.abs(spinta.alto)).toBeLessThanOrEqual(1)

  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowDown')

  const opposta = await bordiFotografia(page)
  expect(Math.abs(opposta.destro - schermo.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(opposta.basso - schermo.height)).toBeLessThanOrEqual(1)
})

/**
 * Col mouse il trascinamento moriva dopo il primo spostamento: l `<img>` fa
 * partire il trascinamento nativo del browser, che chiude il nostro gesto con
 * un `pointercancel`. **Misurato il 2026-08-17** a 1440x900: sei spostamenti da
 * 30px muovevano la fotografia di 30 invece che di 180.
 *
 * Non era una regressione — succedeva anche prima che la cornice si espandesse
 * — ma prima si vedeva molto meno, perche la finestra da percorrere era un
 * quadrato al centro dello schermo e non lo schermo intero.
 */
test('il trascinamento col mouse arriva fino in fondo, non muore al primo scatto', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'il mouse non esiste sul telefono: li il gesto e il dito, gia sotto verifica a mano')

  await apriPrima(page)
  await senzaTransizione(page)
  // Al tetto c e margine di manovra su tutti e due gli assi a qualunque
  // viewport: a livelli bassi una quadrata su uno schermo largo non si sposta
  // in orizzontale nemmeno di un pixel, e il test non direbbe nulla.
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('+')
  await expect(page.getByRole('button', { name: 'Ingrandisci la fotografia' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  const schermo = page.viewportSize()!
  const partenza = await bordiFotografia(page)

  // Quanto si puo percorrere partendo dal centro, meno un pixel di sicurezza.
  // Non e la stessa cifra a ogni browser e va calcolata: su Desktop Safari il
  // rapporto di pixel e 2, il tetto in cifre si dimezza e da un estremo
  // all altro restano 251px invece dei 1783 di Chromium. Con un passo fisso il
  // trascinamento finirebbe contro il limite, e il test misurerebbe quello
  // invece del difetto che insegue.
  const margine = Math.floor((partenza.destro - partenza.sinistro - schermo.width) / 2) - 1
  const scatto = Math.min(30, Math.floor(margine / 6))
  expect(scatto).toBeGreaterThan(5)

  await page.mouse.move(schermo.width / 2, schermo.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(schermo.width / 2 - i * scatto, schermo.height / 2)
    await page.waitForTimeout(50)
  }
  await page.mouse.up()

  const arrivo = await bordiFotografia(page)
  // Sei scatti chiesti, sei percorsi. Prima se ne percorreva uno.
  expect(partenza.sinistro - arrivo.sinistro).toBeCloseTo(scatto * 6, 0)
})

test('nessuna violazione axe con la fotografia ingrandita', async ({ page }) => {
  await apriPrima(page)
  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  // Le transizioni vanno spente: una transizione di colore in corso fa
  // misurare ad axe un contrasto intermedio che non e quello finale.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important }' })

  const esito = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(esito.violations).toEqual([])
})
