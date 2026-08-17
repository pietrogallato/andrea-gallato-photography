import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'
import { MOLTIPLICATORE_MINIMO } from '@/lib/lightbox/zoom'

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
 * mai: su uno schermo 1440x900 il ritaglio restava 702x702 — il 38% — sia a
 * riposo sia al massimo dell ingrandimento. Ora la finestra resta quella che e
 * — la fotografia si dipinge sempre alla stessa larghezza, ed e cio che toglie
 * il salto al primo scatto — ma smette di ritagliare: a ritagliare e lo
 * schermo, e la fotografia lo copre tutto.
 *
 * Si misurano i rettangoli e non le classi CSS: una regola puo esserci ed
 * essere scavalcata, e allora il test direbbe di si mentre l utente vede di no.
 */
test('ingrandendo, la fotografia esce dalla sua finestra e copre lo schermo', async ({ page }) => {
  await apriPrima(page)
  await senzaTransizione(page)
  const schermo = page.viewportSize()!

  const riposo = await bordiFotografia(page)
  expect(riposo.destro - riposo.sinistro).toBeLessThan(schermo.width)
  expect(riposo.basso - riposo.alto).toBeLessThan(schermo.height)

  for (let i = 0; i < 12; i += 1) await page.keyboard.press('+')
  await expect(page.getByRole('button', { name: 'Ingrandisci la fotografia' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  // La finestra e rimasta piccola: e la fotografia a essere uscita. Se il
  // ritaglio fosse ancora suo, questi due fatti non potrebbero coesistere.
  const finestra = await page.evaluate(() => {
    const r = (document.querySelector('dialog figure > div > div') as HTMLElement).getBoundingClientRect()
    return { larghezza: r.width, altezza: r.height }
  })
  expect(finestra.larghezza).toBeLessThan(schermo.width)

  const dopo = await bordiFotografia(page)
  expect(dopo.sinistro).toBeLessThanOrEqual(1)
  expect(dopo.alto).toBeLessThanOrEqual(1)
  expect(dopo.destro).toBeGreaterThanOrEqual(schermo.width - 1)
  expect(dopo.basso).toBeGreaterThanOrEqual(schermo.height - 1)
})

/**
 * Il tetto per quello che e: un pixel del file per ogni pixel dello schermo,
 * non uno di piu.
 *
 * Il test che stava qui prima diceva di inseguire proprio questo e non lo
 * faceva: le sue due asserzioni si semplificavano entrambe in «la fotografia
 * dipinta da ingranditi e piu larga di quella a riposo», cioe una conseguenza
 * diretta di una regola CSS, vera qualunque cosa facesse il calcolo del tetto.
 *
 * Qui il conto si fa dove il difetto vive: al massimo dell ingrandimento, in
 * pixel del dispositivo, contro le dimensioni native che stanno nell URL dell
 * asset. Chiedere piu pixel di quelli che il file ha e esattamente la
 * sgranatura che il tetto esiste per impedire.
 */
test('al tetto la fotografia non viene distesa oltre i pixel del suo file', async ({ page }) => {
  await apriPrima(page)

  for (let i = 0; i < 14; i += 1) await page.keyboard.press('+')
  await expect(page.getByRole('button', { name: 'Ingrandisci la fotografia' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  // `sizes` sale solo a gradino scaricato e decodificato, dopo il riposo di
  // 200ms che tiene la rete fuori dal gesto: senza questa attesa si leggerebbe
  // ancora quello di partenza, che e un espressione CSS e non un numero.
  await expect
    .poll(() => page.getAttribute('dialog figure img', 'sizes'), { timeout: 10_000 })
    .toMatch(/^\d+px$/)

  const misure = await page.evaluate(() => {
    const img = document.querySelector('dialog figure img') as HTMLImageElement
    const finestra = document.querySelector('dialog figure > div > div') as HTMLElement
    const superficie = document.querySelector('dialog figure > div') as HTMLElement
    const livelloOra = Number(getComputedStyle(superficie).getPropertyValue('--zoom'))
    const dimensioni = /-(\d+)x(\d+)\./.exec(img.getAttribute('src') ?? '')
    return {
      nativi: dimensioni ? Number(dimensioni[1]) : 0,
      dipintaDispositivo: finestra.getBoundingClientRect().width * window.devicePixelRatio,
      resa: finestra.getBoundingClientRect().width * livelloOra * window.devicePixelRatio,
      resaCss: finestra.getBoundingClientRect().width * livelloOra,
      sizes: img.getAttribute('sizes'),
    }
  })

  // Senza dimensioni nell URL il resto del test non direbbe nulla.
  expect(misure.nativi).toBeGreaterThan(0)

  // Il consentito e il maggiore fra i pixel veri e il minimo garantito, che
  // esiste perche meta archivio e esportato a 1080px di lato lungo e col
  // criterio rigoroso l ingrandimento sarebbe spento la meta delle volte. Su
  // uno schermo a 2x il minimo e proprio il ramo che vince.
  const consentito = Math.max(misure.nativi, misure.dipintaDispositivo * MOLTIPLICATORE_MINIMO)
  expect(misure.resa).toBeLessThanOrEqual(consentito + 1)
  // E il tetto ci arriva, non si ferma prima: un tetto troppo basso lascerebbe
  // sul tavolo i pixel che il visitatore e venuto a guardare.
  expect(misure.resa).toBeGreaterThan(consentito * 0.98)
  // La variante chiesta alla CDN e la stessa cosa detta in pixel CSS: se
  // `sizes` non seguisse il tetto, i pixel in piu resterebbero teorici.
  expect(Number(misure.sizes?.replace('px', ''))).toBeCloseTo(misure.resaCss, -1)
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

/**
 * Da ingranditi la fotografia arriva a coprire lo schermo, e passa quindi
 * sopra il punto dove sta il pulsante che chiude. Nel JSX quel pulsante viene
 * prima della figure, e sia l `<img>` (che porta una trasformazione) sia il suo
 * contenitore dipingono nella fase degli elementi posizionati: fra pari,
 * decide l ordine dell albero, e la fotografia vince. **Misurato il
 * 2026-08-17** a 1440x900 prima del rimedio, con un solo colpo di `+`:
 * `elementFromPoint` al centro del pulsante restituiva l `<img>`, il clic non
 * chiudeva, e da ingranditi restavano solo Esc due volte o il ritorno a
 * schermo intero. Peggio col fuoco: il contorno spariva sotto la fotografia,
 * che WCAG 2.4.11 non consente.
 */
test('da ingranditi il pulsante che chiude resta sopra la fotografia', async ({ page }) => {
  await apriPrima(page)
  // Senza togliere la transizione la fotografia e ancora a meta strada quando
  // si misura, e il difetto — che si presenta a fotografia arrivata — non si
  // vede: il test passerebbe con il difetto in vigore.
  await senzaTransizione(page)
  await page.getByRole('button', { name: 'Ingrandisci la fotografia' }).click()

  const chiudi = page.getByRole('button', { name: 'Chiudi' })
  const riquadro = (await chiudi.boundingBox())!
  const centro = { x: riquadro.x + riquadro.width / 2, y: riquadro.y + riquadro.height / 2 }

  // Chi c e sotto quel punto lo dice il browser, non il foglio di stile.
  const sotto = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el?.closest('button') ? 'pulsante' : (el?.tagName ?? 'niente')
    },
    centro,
  )
  expect(sotto).toBe('pulsante')

  // E un clic vero, non `.click()` di Playwright, che troverebbe comunque
  // l elemento: qui si chiede al mouse di premere in quel punto dello schermo.
  await page.mouse.click(centro.x, centro.y)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

/**
 * I comandi sovrapposti alla fotografia e il caso peggiore, che e il bianco.
 *
 * Il fondo semitrasparente sotto le icone esiste proprio per questo: con il
 * margine laterale a 16px le frecce cadono per intero sopra la fotografia, e un
 * segno grigio su uno scatto chiaro non si legge. WCAG 1.4.11 chiede 3:1 a un
 * elemento non testuale che porta informazione. **Misurato a pixel il
 * 2026-08-17** su build di produzione, fotografia servita bianca, 412x915: col
 * fondo al 72% il composito era rgb(77,77,78) contro un tratto rgb(143,141,138),
 * cioe 2,55:1 — sotto soglia, e paradossalmente peggio del 3,31:1 che l icona
 * nuda aveva sul bianco puro.
 *
 * Il conto si fa qui col compositore del browser — si dipinge il fondo del
 * comando sopra il bianco su una tela — invece che leggendo i pixel di uno
 * scatto: cosi il test dice la stessa cosa su tutti i viewport, anche dove il
 * comando cade sul nero e il caso peggiore non si presenta.
 */
test('i comandi sovrapposti restano leggibili anche sopra il bianco', async ({ page }) => {
  await apriPrima(page)

  for (const nome of ['Fotografia successiva', 'Ingrandisci la fotografia']) {
    const misura = await page.getByRole('button', { name: nome }).evaluate((el) => {
      const stile = getComputedStyle(el)
      const tela = document.createElement('canvas')
      tela.width = 1
      tela.height = 1
      const ctx = tela.getContext('2d')!
      const dipingi = (colore: string, sopra?: string) => {
        ctx.clearRect(0, 0, 1, 1)
        if (sopra) {
          ctx.fillStyle = sopra
          ctx.fillRect(0, 0, 1, 1)
        }
        ctx.fillStyle = colore
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      return { fondo: dipingi(stile.backgroundColor, '#ffffff'), tratto: dipingi(stile.color) }
    })

    const luminanza = (c: number[]) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const [chiaro, scuro] = [luminanza(misura.fondo), luminanza(misura.tratto)].sort((a, b) => b - a)
    expect((chiaro + 0.05) / (scuro + 0.05)).toBeGreaterThanOrEqual(3)
  }
})

/**
 * Il confine fra i due stati non deve sentirsi.
 *
 * Il livello e continuo, e la cornice deve esserlo con lui. **Misurato il
 * 2026-08-17** a 1440x900 prima del rimedio: la pizzicata da trackpad piu
 * piccola possibile — ctrl + rotella con deltaY -1 — alzava il livello dello
 * 0,40% e la fotografia sullo schermo passava da 774 a 903,6 pixel, il 16,7%
 * in piu, con l angolo in alto a sinistra spostato di 65px. Il fattore fra le
 * due geometrie si aggiungeva tutto insieme al primo micro-ingrandimento.
 *
 * In verticale resta uno scarto: entrando nell ingrandimento la didascalia si
 * ritira e la fotografia si ricentra sullo schermo — 24,8px a 1440x900, senza
 * cambiare dimensione. E il movimento della didascalia che se ne va, non un
 * salto di scala, e per questo qui si misurano la larghezza e il centro
 * orizzontale.
 */
test('il primo scatto di ingrandimento non fa saltare la fotografia', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'la rotella non esiste sul mobile, e Playwright non la emula')

  await apriPrima(page)
  await senzaTransizione(page)
  const schermo = page.viewportSize()!
  const prima = await bordiFotografia(page)

  await page.mouse.move(schermo.width / 2, schermo.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -1)
  await page.keyboard.up('Control')

  const salito = await livello(page)
  expect(salito).toBeGreaterThan(1)
  expect(salito).toBeLessThan(1.02)

  const dopo = await bordiFotografia(page)
  const larghezzaPrima = prima.destro - prima.sinistro
  // Un ingrandimento dello 0,4% deve valere lo 0,4%, non il 17%.
  expect(dopo.destro - dopo.sinistro).toBeCloseTo(larghezzaPrima * salito, 0)
  expect((dopo.destro + dopo.sinistro) / 2).toBeCloseTo((prima.destro + prima.sinistro) / 2, 0)
})

/**
 * Il punto fisso della pizzicata attraverso il confine fra i due stati.
 *
 * Il conto compone i soli livelli e assume che la scatola dipinta sotto la
 * trasformazione non cambi: finche quella scatola cresceva passando a tutto
 * schermo, l assunzione saltava proprio nel gesto piu comune, la prima
 * pizzicata. **Misurato il 2026-08-17** a 1440x900 prima del rimedio: pizzicando
 * da riposo su un punto al 25% della fotografia, quel punto finiva 92,5px piu
 * a sinistra.
 *
 * Si pizzica forte, in un colpo solo, perche il punto fisso e onorabile solo
 * dove c e spostamento da spendere: finche la fotografia sta dentro lo schermo
 * il limite la tiene centrata — a ragione, altrimenti entrerebbe lo sfondo — e
 * nessun conto puo tenere fermo il dettaglio sotto il dito. Per lo stesso
 * motivo la distanza dal centro va calcolata e non fissata: su Desktop Safari
 * il rapporto di pixel e 2, il tetto scende al minimo garantito e da un estremo
 * all altro restano un centinaio di pixel invece di milleseicento.
 */
test('pizzicando da riposo il dettaglio sotto il dito non scappa di lato', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'la rotella non esiste sul mobile, e Playwright non la emula')

  await apriPrima(page)
  await senzaTransizione(page)
  const schermo = page.viewportSize()!

  // Dove arriva il tetto, per sapere quanto spostamento ci sara da spendere.
  for (let i = 0; i < 14; i += 1) await page.keyboard.press('+')
  const tetto = await livello(page)
  await page.keyboard.press('0')

  const prima = await bordiFotografia(page)
  const larghezza = prima.destro - prima.sinistro
  const centro = (prima.sinistro + prima.destro) / 2
  const spostamentoMassimo = (larghezza * tetto - schermo.width) / 2
  // Il 90% del punto piu lontano ancora raggiungibile: al limite esatto un
  // decimale di arrotondamento basterebbe a far tagliare lo spostamento, e il
  // test misurerebbe il limite invece del punto fisso.
  const distanza = Math.min(larghezza * 0.25, spostamentoMassimo / (tetto - 1)) * 0.9
  expect(distanza).toBeGreaterThan(20)

  // Intero: il puntatore arriva alla pagina con coordinate arrotondate, e
  // chiedendo 779,32 il gesto lavorerebbe su 779 mentre il test si aspetta
  // 779,32. Sarebbero 1,25px di scarto che non c entrano col punto fisso.
  const x = Math.round(centro + distanza)
  const frazione = (x - prima.sinistro) / larghezza
  await page.mouse.move(x, Math.round((prima.alto + prima.basso) / 2))
  await page.keyboard.down('Control')
  // Un colpo solo che porta esattamente al tetto: il fattore della rotella e
  // esponenziale con sensibilita 250.
  await page.mouse.wheel(0, -250 * Math.log(tetto))
  await page.keyboard.up('Control')

  const dopo = await bordiFotografia(page)
  expect(dopo.destro - dopo.sinistro).toBeGreaterThan(larghezza * 1.5)

  const finito = dopo.sinistro + (dopo.destro - dopo.sinistro) * frazione
  expect(finito).toBeCloseTo(x, 0)
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
