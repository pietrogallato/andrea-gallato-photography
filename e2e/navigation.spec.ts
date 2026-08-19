import { test, expect, nuovoContesto } from './fixtures'
import sharp from 'sharp'

/**
 * Sotto il breakpoint mobile il selettore lingua non sta nell header: vive nel
 * pannello del menu, perche su una riga sola sfondava il viewport. I test che
 * lo usano devono quindi aprirlo prima.
 */
async function apriControlli(page: import('@playwright/test').Page, isMobile?: boolean) {
  if (!isMobile) return
  // Idempotente: a menu gia aperto il pulsante si chiama "Chiudi il menu",
  // quindi il localizzatore non trova nulla e non si fa nulla.
  const trigger = page.getByRole('button', { name: /Apri il menu|Open menu/ })
  if (await trigger.isVisible().catch(() => false)) await trigger.click()
}


test('la radice reindirizza alla home italiana', async ({ page }) => {
  const response = await page.goto('/')
  expect(page.url()).toContain('/it')
  expect(response?.status()).toBe(200)
})

test('la home italiana dichiara lang="it"', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
})

test('la home inglese dichiara lang="en"', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il selettore lingua porta alla pagina equivalente', async ({ page, isMobile }) => {
  await page.goto('/it')
  await apriControlli(page, isMobile)
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il nome canonico interno restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/gallery')
  expect(response?.status()).toBe(404)
})

test('il segmento della lingua sbagliata restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/photographs')
  expect(response?.status()).toBe(404)
})

test('un locale non supportato restituisce 404', async ({ page }) => {
  const response = await page.goto('/fr')
  expect(response?.status()).toBe(404)
})

test('gli href del selettore lingua sono corretti nell HTML senza JavaScript', async ({ browser }) => {
  // Viewport desktop esplicito: senza JavaScript il menu mobile non si apre,
  // e sotto il breakpoint il selettore lingua vive li dentro.
  const context = await nuovoContesto(browser, { javaScriptEnabled: false, viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  await page.goto('/it')

  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en')
  await context.close()
})

test('lo skip link diventa visibile al primo Tab e porta al contenuto', async ({
  page,
  browserName,
}) => {
  // WebKit salta gli <a> nella tabulazione: e il comportamento predefinito di
  // Safari, che evidenzia solo i controlli di form finche l utente non attiva
  // "Premi Tab per evidenziare ogni elemento". Verificato con un esperimento di
  // controllo su una pagina HTML nuda: in WebKit l ordine di tabulazione di
  // due link e un pulsante e ["button"], non ["a","a","button"].
  // Il test verifica la nostra implementazione, non la preferenza di Safari.
  test.skip(browserName === 'webkit', 'WebKit non tabula sui link per impostazione predefinita')

  await page.goto('/it')
  await page.keyboard.press('Tab')

  const skip = page.getByRole('link', { name: 'Vai al contenuto' })
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page).toHaveURL(/#main$/)
})

test('la pagina About esiste in entrambe le lingue', async ({ page }) => {
  const it = await page.goto('/it/about')
  expect(it?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const en = await page.goto('/en/about')
  expect(en?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('About mostra il ritratto con un testo alternativo sensato', async ({ page }) => {
  await page.goto('/it/about')

  // Lo schema del ritratto non ha un campo alt: il testo si compone dal
  // dizionario e dal nome del fotografo, quindi non e mai vuoto.
  const ritratto = page.locator('main img').first()
  await expect(ritratto).toBeVisible()
  await expect(ritratto).toHaveAttribute('alt', /Ritratto di/)
})

test('la voce About porta alla pagina About', async ({ page, isMobile }) => {
  await page.goto('/it')
  if (isMobile) await page.getByRole('button', { name: /Apri il menu|Open menu/ }).click()

  await page.getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL('/it/about')
})

test('il selettore lingua resta sulla stessa pagina, non riporta alla home', async ({
  page,
  isMobile,
}) => {
  await page.goto('/it/about')
  await apriControlli(page, isMobile)
  await page.getByRole('link', { name: 'English' }).click()

  await expect(page).toHaveURL('/en/about')
})

test('resta sulla stessa pagina anche dalla galleria, dove il segmento cambia nome', async ({
  page,
  isMobile,
}) => {
  await page.goto('/it/fotografie')
  await apriControlli(page, isMobile)
  await page.getByRole('link', { name: 'English' }).click()

  await expect(page).toHaveURL('/en/photographs')
})

test('gli href del selettore puntano alla pagina corrente gia nell HTML, senza JavaScript', async ({
  browser,
}) => {
  const context = await nuovoContesto(browser, {
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()
  await page.goto('/it/about')

  // Il selettore e reso anche in SSR: se dipendesse dall idratazione, qui
  // troveremmo ancora il collegamento alla home.
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/about')
  await context.close()
})

/**
 * Regressione riportata dall utente: a menu aperto la schermata era
 * disordinata e non si capiva come uscirne.
 *
 * La causa: il pannello aveva `z-index: 30` e l header `20`, quindi il
 * pannello copriva l header. Il nome del sito spariva e il pulsante di
 * chiusura restava dipinto sotto, invisibile e non cliccabile.
 */
test('a menu aperto restano visibili il nome del sito e la chiusura', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'il menu a pannello esiste solo sotto il breakpoint')

  await page.goto('/it/fotografie')
  await page.getByRole('button', { name: 'Apri il menu' }).click()

  await expect(page.getByRole('link', { name: 'Andrea Gallato' })).toBeVisible()

  const chiudi = page.getByRole('button', { name: 'Chiudi il menu' })
  await expect(chiudi).toBeVisible()

  // `click` fallisce se l elemento e coperto da un altro: e esattamente il
  // difetto, e nessuna asserzione sulla sola visibilita lo avrebbe colto.
  await chiudi.click({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeVisible()
})

/**
 * Sostituisce «il menu aperto parte sotto l header, senza il vuoto di prima».
 *
 * Quel test prendeva il primo link del pannello per verificare che le voci non
 * fossero centrate con un vuoto sopra e uno sotto. Due cose lo hanno reso
 * obsoleto insieme: il pannello adesso e progettato al contrario — le voci si
 * DISTRIBUISCONO sull altezza invece di partire in cima — e, passate le lingue
 * in testa, il primo link del pannello non era piu una voce di navigazione ma
 * «IT». Continuava a passare misurando un elemento di cui non parlava, che e
 * il modo peggiore in cui un test puo sopravvivere a un cambio di design.
 *
 * **Misurato il 2026-08-17** a 412x915: prima le voci occupavano 219px e
 * lasciavano 463px di nero fra loro e il fondo, cioe il 51% dello schermo
 * vuoto; adesso ne occupano 553, il 60%.
 */
test('le voci del menu riempiono il pannello invece di impilarsi in cima', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'il menu a pannello esiste solo sotto il breakpoint')

  await page.goto('/it/fotografie')
  await page.getByRole('button', { name: 'Apri il menu' }).click()

  // La navigazione per nome, non il primo `a` che capita: nel pannello ci sono
  // anche i due link della lingua, ed e proprio confonderli con le voci che ha
  // svuotato di senso il test precedente.
  const voci = page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link')
  await expect(voci).toHaveCount(4)

  const misure = await page.evaluate(() => {
    // Per nome anche qui: `nav[aria-label]` senza valore prende il primo, che
    // e quello delle lingue — cioe lo stesso inciampo del test che questo
    // sostituisce.
    const nav = document.querySelector(
      '[data-pannello-menu] nav[aria-label="Navigazione principale"]',
    )!
    const link = [...nav.querySelectorAll('a')]
    const primo = link[0].getBoundingClientRect()
    const ultima = link[link.length - 1].getBoundingClientRect()
    return {
      bloccoVoci: ultima.bottom - primo.top,
      schermo: window.innerHeight,
      fondoDellUltima: ultima.bottom,
      areaTattileMinima: Math.min(...link.map((a) => a.getBoundingClientRect().height)),
    }
  })

  // Meta schermo e la soglia sotto cui il vuoto ricomincia a dominare: col
  // layout precedente le voci ne coprivano un quarto.
  expect(misure.bloccoVoci).toBeGreaterThan(misure.schermo * 0.5)
  expect(misure.fondoDellUltima).toBeLessThanOrEqual(misure.schermo)
  // Le voci sono anche i bersagli da toccare: distribuirle non deve averne
  // fatto strisce sottili.
  expect(misure.areaTattileMinima).toBeGreaterThanOrEqual(44)
})

/**
 * Regressione riportata dall utente su iPhone: aperto il menu, il pannello
 * copriva una striscia in cima allo schermo e la voce «Progetti» restava
 * tagliata a meta. Sullo stesso sito, da Android, si vedeva giusto.
 *
 * La causa non e il menu: un elemento con `backdrop-filter` diventa il blocco
 * contenitore dei suoi discendenti `position: fixed`, e il pannello e un
 * discendente dell header, che il filtro ce l ha. Col filtro acceso il suo
 * `inset: 0` non si riferisce piu allo schermo ma all header.
 *
 * **Misurato il 2026-08-17**: 157px di pannello su 852 di schermo col filtro,
 * 852 togliendolo, di nuovo 157 rimettendolo. Su Chromium sempre 852, ed e il
 * motivo per cui il difetto si vedeva solo su un telefono. Questo test gira
 * anche sul progetto webkit, che e il motore di ogni browser su iPhone: e li
 * che deve mordere.
 */
test('il pannello del menu copre tutto lo schermo, non una striscia', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'il menu a pannello esiste solo sotto il breakpoint')

  await page.goto('/it')
  await page.getByRole('button', { name: 'Apri il menu' }).click()

  const misure = await page.evaluate(() => {
    const pannello = document.querySelector('[data-pannello-menu]') as HTMLElement
    const voci = [...pannello.querySelectorAll('a')]
    return {
      altezza: pannello.getBoundingClientRect().height,
      schermo: window.innerHeight,
      fondoDellUltimaVoce: voci[voci.length - 1].getBoundingClientRect().bottom,
    }
  })

  expect(misure.altezza).toBeGreaterThanOrEqual(misure.schermo - 1)
  // Il sintomo che l utente ha visto: col pannello schiacciato l ultima voce
  // cadeva fuori dallo schermo, tagliata a meta.
  expect(misure.fondoDellUltimaVoce).toBeLessThanOrEqual(misure.schermo)
})

test('la voce della pagina corrente e segnata', async ({ page, isMobile }) => {
  await page.goto('/it/fotografie')
  if (isMobile) await page.getByRole('button', { name: 'Apri il menu' }).click()

  await expect(page.getByRole('link', { name: 'Fotografie' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Progetti' })).not.toHaveAttribute('aria-current', 'page')
})

/**
 * La striscia della testata resta della testata, anche quando il pannello del
 * menu scorre.
 *
 * Il pannello e `position: fixed; inset: 0`: copre lo schermo intero, testata
 * compresa, e si tiene le voci lontane dal bordo alto con un riempimento pari
 * all altezza dell header. Quel riempimento pero e dentro l area che scorre:
 * appena il contenuto supera lo schermo, le voci gli passano sopra e finiscono
 * nella striscia dell header. Li sotto non c e niente che le fermi, perche il
 * fondo dell header appartiene all elemento che crea il contesto di
 * impilamento e si dipinge PRIMA dei suoi discendenti posizionati — pannello
 * incluso. Il risultato: «IT», «EN» e «Home» sovrapposti al nome del sito e
 * alla X di chiusura.
 *
 * Non serve un telefono strano per arrivarci: bastano 375px di altezza, cioe
 * un iPhone SE girato di lato. **Misurato il 2026-08-19** a 667x375, che e la
 * sua misura in orizzontale: il pannello vuole 415px e ne ha 375, quindi
 * scorre. Il viewport dei progetti della suite e piu alto e non ci arriva mai,
 * ed e il motivo per cui nessun test lo vedeva.
 *
 * Nella striscia dell header, fuori dal nome e dal pulsante, comparivano pixel
 * fino a 143,141,138 — cioe testo del pannello. Dopo, il massimo e lo sfondo.
 */
test('a pannello scorso le voci non entrano nella striscia dell header', async ({ browser }) => {
  const context = await nuovoContesto(browser, { viewport: { width: 667, height: 375 } })
  const page = await context.newPage()
  await page.goto('/it/fotografie')
  await page.getByRole('button', { name: 'Apri il menu' }).click()

  const rilievo = await page.evaluate(() => {
    const pannello = document.querySelector('[data-pannello-menu]') as HTMLElement
    pannello.scrollTop = pannello.scrollHeight
    const header = document.querySelector('header')!.getBoundingClientRect()
    const nome = document.querySelector('header a')!.getBoundingClientRect()
    const chiusura = document
      .querySelector('header button[aria-expanded]')!
      .getBoundingClientRect()
    const riquadro = (r: DOMRect) => ({ x: r.x, y: r.y, destra: r.right, fondo: r.bottom })
    return {
      scorre: pannello.scrollHeight > pannello.clientHeight,
      header: { x: header.x, y: header.y, larghezza: header.width, altezza: header.height },
      esclusi: [riquadro(nome), riquadro(chiusura)],
    }
  })

  // Senza scorrimento il test non guarderebbe il caso di cui parla.
  expect(rilievo.scorre).toBe(true)

  const png = await page.screenshot({
    clip: {
      x: rilievo.header.x,
      y: rilievo.header.y,
      width: rilievo.header.larghezza,
      height: rilievo.header.altezza,
    },
  })
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  const scala = info.width / rilievo.header.larghezza

  // Due pixel di margine attorno a cio che nella striscia ci sta di diritto:
  // l antialiasing dei glifi sborda di poco oltre il riquadro del testo.
  const dentroUnEscluso = (xCss: number, yCss: number) =>
    rilievo.esclusi.some(
      (r) => xCss >= r.x - 2 && xCss <= r.destra + 2 && yCss >= r.y - 2 && yCss <= r.fondo + 2,
    )

  let massimo = 0
  for (let py = 0; py < info.height; py++) {
    for (let px = 0; px < info.width; px++) {
      const xCss = rilievo.header.x + px / scala
      const yCss = rilievo.header.y + py / scala
      if (dentroUnEscluso(xCss, yCss)) continue
      const i = (py * info.width + px) * info.channels
      massimo = Math.max(massimo, data[i], data[i + 1], data[i + 2])
    }
  }

  // Lo sfondo e 8,8,10. Il testo del pannello e 143,141,138: fra i due c e
  // tutto lo spazio che serve perche questa soglia non sia una taratura.
  expect(massimo, 'canale piu chiaro trovato nella striscia dell header').toBeLessThanOrEqual(24)
  await context.close()
})

/**
 * Allargando la finestra a menu aperto, l header torna quello del desktop e le
 * sue voci devono esserci.
 *
 * Il pannello resta «aperto» nello stato di React anche quando il breakpoint lo
 * nasconde, quindi il selettore che accende lo strato di mascheratura della
 * testata — `:has([data-pannello-menu]:not([hidden]))` — continua a
 * corrispondere: guarda l attributo, non cio che si vede. Senza confinare quel
 * selettore sotto il breakpoint, lo strato si stende sopra le voci del desktop,
 * che non hanno z-index e stanno sotto qualunque valore positivo.
 *
 * **Misurato il 2026-08-19**: menu aperto a 390px, finestra portata a 1280, e il
 * riquadro di «Fotografie» leggeva 8,8,10 su tutti e tre i canali, cioe solo
 * sfondo. La voce c era per il DOM e per axe, e non si vedeva.
 */
test('allargando la finestra a menu aperto le voci del desktop restano visibili', async ({
  browser,
}) => {
  const context = await nuovoContesto(browser, { viewport: { width: 390, height: 664 } })
  const page = await context.newPage()
  await page.goto('/it/fotografie')
  await page.getByRole('button', { name: 'Apri il menu' }).click()
  await page.setViewportSize({ width: 1280, height: 720 })

  const voce = page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link', {
    name: 'Fotografie',
  })
  await expect(voce).toBeVisible()

  const riquadro = (await voce.boundingBox())!
  const png = await page.screenshot({ clip: riquadro })
  const statistiche = await sharp(png).stats()
  const massimo = Math.max(...statistiche.channels.slice(0, 3).map((c) => c.max))

  // Lo sfondo e 8,8,10; la voce della pagina corrente e disegnata a `--fg`,
  // 242,240,237. Qualunque soglia in mezzo separa «si vede» da «e coperta».
  expect(massimo, 'canale piu chiaro nel riquadro della voce').toBeGreaterThan(100)
  await context.close()
})
