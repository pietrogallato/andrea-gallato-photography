import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'

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

/**
 * Il contrasto dell header sopra le fotografie, misurato sui pixel resi.
 *
 * L header e appiccicato in cima e traslucido: cio che gli scorre sotto sono
 * le fotografie, di qualunque tono. Le sue etichette — voci di navigazione e
 * codici lingua, 11px a `--fg-muted` — e il simbolo del menu sul telefono sono
 * disegnati su quel fondo, quindi e il fondo a dover garantire il contrasto da
 * solo. E l unico mestiere dello scrim.
 *
 * Le scansioni axe qui sopra non lo vedono e non lo vedranno mai: il controllo
 * del contrasto si dichiara «incomplete», non «violation», ogni volta che
 * dietro il testo c e un immagine — cioe sempre, qui. Passavano tutte con
 * l header COMPLETAMENTE trasparente.
 *
 * **Misurato il 2026-08-19** su /it/fotografie servendo una fotografia in tinta
 * unita al posto di quelle vere. Con `background: rgb(var(--scrim) / 0.72)`,
 * dove `--scrim` era `8, 8, 10`, la dichiarazione mescolava la sintassi con le
 * virgole e quella con lo slash: `rgb()` non la accetta, il browser la scarta e
 * l header restava senza fondo. Il pixel dell header sotto una foto bianca era
 * 255,255,255 (3.31:1 col simbolo) e sotto una foto del tono esatto di
 * `--fg-muted` era 143,141,138, cioe 1.00:1 — il simbolo spariva.
 *
 * La soglia e 4.5 e non 3: sopra questo fondo non c e solo il simbolo del menu,
 * che sarebbe un elemento grafico da 3:1 (WCAG 1.4.11), ci sono anche le
 * etichette da 11px dell header desktop, che sono testo (WCAG 1.4.3).
 */
const FONDALI = [
  // Il peggiore col difetto: stesso tono del testo, contrasto 1:1.
  { nome: 'del tono di --fg-muted', rgb: [0x8f, 0x8d, 0x8a] },
  // Il peggiore una volta corretto: piu lo scrim schiarisce, meno stacca.
  { nome: 'bianca', rgb: [255, 255, 255] },
]

const FG_MUTED = [0x8f, 0x8d, 0x8a]

function luminanza([r, g, b]: number[]) {
  const canale = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b)
}

function contrasto(a: number[], b: number[]) {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x)
  return (chiaro + 0.05) / (scuro + 0.05)
}

for (const fondale of FONDALI) {
  test(`il fondo dell header stacca dalle sue etichette sopra una fotografia ${fondale.nome}`, async ({
    page,
    context,
  }) => {
    // Registrata DOPO quella del fixture, quindi vince: Playwright prova le
    // rotte dall ultima alla prima.
    const tinta = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: fondale.rgb[0], g: fondale.rgb[1], b: fondale.rgb[2] },
      },
    })
      .jpeg()
      .toBuffer()
    await context.route('**cdn.sanity.io**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: tinta }),
    )

    await page.goto('/it/fotografie')
    // Sotto l header devono esserci le fotografie, non lo sfondo della pagina:
    // a pagina in cima l header sta sopra il vuoto e il difetto non si vede.
    await page.evaluate(() => window.scrollTo(0, 900))
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)))
      .toBeGreaterThan(0)
    await page.waitForLoadState('networkidle')

    const rilievo = await page.evaluate(() => {
      const header = document.querySelector('header')!
      const r = header.getBoundingClientRect()
      const y = Math.round(r.top + r.height / 2)
      // Solo i punti in cui sopra il fondo non c e nient altro: sono quelli in
      // cui il pixel letto E il fondo, senza testo o icone di mezzo.
      const liberi: number[] = []
      for (let x = Math.round(r.left) + 2; x < r.right - 2; x += 3) {
        if (document.elementFromPoint(x, y) === header) liberi.push(x)
      }
      return { x: r.x, y: r.y, larghezza: r.width, altezza: r.height, yCampione: y, liberi }
    })

    // Se non ci fosse un solo punto libero il test non misurerebbe niente e
    // passerebbe lo stesso: e il modo in cui un test smette di dire qualcosa.
    expect(rilievo.liberi.length).toBeGreaterThan(5)

    const png = await page.screenshot({
      clip: {
        x: rilievo.x,
        y: rilievo.y,
        width: rilievo.larghezza,
        height: rilievo.altezza,
      },
    })
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
    const scala = info.width / rilievo.larghezza

    let peggiore = Infinity
    let pixelPeggiore: number[] = []
    for (const x of rilievo.liberi) {
      const px = Math.floor((x - rilievo.x) * scala)
      const py = Math.floor((rilievo.yCampione - rilievo.y) * scala)
      const i = (py * info.width + px) * info.channels
      const pixel = [data[i], data[i + 1], data[i + 2]]
      const r = contrasto(FG_MUTED, pixel)
      if (r < peggiore) {
        peggiore = r
        pixelPeggiore = pixel
      }
    }

    expect(
      peggiore,
      `pixel peggiore del fondo dell header: ${pixelPeggiore.join(',')}`,
    ).toBeGreaterThanOrEqual(4.5)
  })
}
