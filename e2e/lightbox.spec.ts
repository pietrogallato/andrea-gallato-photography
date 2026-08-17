import { test, expect } from './fixtures'

async function openFirst(page: import('@playwright/test').Page) {
  await page.goto('/it/fotografie')
  await page.locator('[data-row] button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('si apre e si chiude con il pulsante', async ({ page }) => {
  await openFirst(page)
  await page.getByRole('button', { name: 'Chiudi' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('si chiude con Esc', async ({ page }) => {
  await openFirst(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('naviga con le frecce', async ({ page }) => {
  await openFirst(page)
  const first = await page.getByRole('dialog').getAttribute('aria-label')

  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog')).not.toHaveAttribute('aria-label', first!)
})

/**
 * Lo swipe, esercitato con `page.mouse`: sono eventi di puntatore autentici,
 * consegnati agli stessi gestori che riceve un dito. In jsdom si surrogano
 * `setPointerCapture` e la geometria, quindi cio che li resta indimostrato e
 * proprio questo — che il gesto arrivi, che la cattura non lo dirotti, e che la
 * fotografia si muova davvero sullo schermo.
 */
async function trascina(
  page: import('@playwright/test').Page,
  { dx, passi = 6, durataMs = 300 }: { dx: number; passi?: number; durataMs?: number },
) {
  const riquadro = (await page.locator('dialog figure > div').boundingBox())!
  const y = riquadro.y + riquadro.height / 2
  const partenza = riquadro.x + riquadro.width / 2
  await page.mouse.move(partenza, y)
  await page.mouse.down()
  for (let i = 1; i <= passi; i += 1) {
    await page.mouse.move(partenza + (dx * i) / passi, y)
    await page.waitForTimeout(durataMs / passi)
  }
  return { riquadro, fine: { x: partenza + dx, y } }
}

/** Lo spostamento orizzontale davvero applicato alla fotografia, in pixel. */
async function spostamentoDipinto(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const img = document.querySelector('dialog figure img') as HTMLElement
    return new DOMMatrixReadOnly(getComputedStyle(img).transform).m41
  })
}

test('a riposo il trascinamento orizzontale cambia fotografia, e la fotografia segue il dito', async ({
  page,
}) => {
  await openFirst(page)
  const prima = await page.getByRole('dialog').getAttribute('aria-label')

  // Un terzo della larghezza: oltre il quinto che decide, e senza contare
  // sulla velocita, che qui non e governabile con precisione.
  const riquadro = (await page.locator('dialog figure > div').boundingBox())!
  const dx = -Math.round(riquadro.width / 3)
  await trascina(page, { dx })

  // Ancora col dito giu: la fotografia deve essere gia di traverso, o lo swipe
  // sarebbe un interruttore nascosto che agisce solo al rilascio.
  const seguito = await spostamentoDipinto(page)
  expect(seguito).toBeLessThan(0)
  expect(seguito).toBeCloseTo(dx, -1)

  await page.mouse.up()
  await expect(page.getByRole('dialog')).not.toHaveAttribute('aria-label', prima!)
  // E rimessa dritta: la fotografia nuova non entra di traverso.
  await expect.poll(() => spostamentoDipinto(page)).toBe(0)
})

test('un trascinamento corto non cambia fotografia e la rimette a posto', async ({ page }) => {
  await openFirst(page)
  const prima = await page.getByRole('dialog').getAttribute('aria-label')

  const riquadro = (await page.locator('dialog figure > div').boundingBox())!
  // Un decimo, cioe meta della soglia, e abbastanza lento da non passare per
  // colpetto: 800ms per percorrerlo.
  await trascina(page, { dx: -Math.round(riquadro.width / 10), durataMs: 800 })
  await page.mouse.up()

  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', prima!)
  await expect.poll(() => spostamentoDipinto(page)).toBe(0)
})

test('rende inerte il contenuto sottostante', async ({ page }) => {
  await openFirst(page)

  // showModal() mette la dialog nel top layer: il contenuto esterno non
  // riceve il focus. Verificabile solo qui, non in jsdom.
  const headerFocusable = await page.locator('header a').first().evaluate((el) => {
    ;(el as HTMLElement).focus()
    return document.activeElement === el
  })

  expect(headerFocusable).toBe(false)
})

test('non lascia scorrere la pagina sotto e ripristina la posizione', async ({ page }) => {
  await page.goto('/it/fotografie')

  // Il tile va portato in vista PRIMA di leggere la posizione: cliccando,
  // Playwright lo scorrerebbe comunque in vista, cambiando lo scorrimento
  // dopo la misura. Un utente vero non provoca quel movimento.
  const tile = page.locator('[data-row] button').nth(8)
  await tile.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)

  await tile.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  expect(await page.evaluate(() => window.scrollY)).toBe(before)
})

test('restituisce il focus al tile di origine', async ({ page }) => {
  await page.goto('/it/fotografie')
  const tile = page.locator('[data-row] button').first()

  await tile.click()
  await page.keyboard.press('Escape')

  await expect(tile).toBeFocused()
})

test('resta aperta e non si richiude da sola', async ({ page }) => {
  await openFirst(page)

  // In sviluppo React monta due volte: se lo smontaggio fosse collegato
  // all evento `close` invece che a `cancel`, la chiusura programmatica del
  // cleanup accoderebbe un evento che chiude la lightbox subito dopo averla
  // riaperta. Si vedrebbe come un lampo.
  await page.waitForTimeout(1200)
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('mostra la fotografia a dimensione utile, dentro il viewport', async ({ page }) => {
  await openFirst(page)

  // La variante richiesta su desktop e grande e arriva dopo che la dialog e
  // gia visibile: senza attesa si misurerebbe un immagine non ancora caricata.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const img = document.querySelector('dialog img') as HTMLImageElement | null
          return !!img && img.complete && img.naturalWidth > 0
        }),
      { timeout: 15_000 },
    )
    .toBe(true)

  const misure = await page.evaluate(() => {
    const img = document.querySelector('dialog img') as HTMLImageElement
    // Il rettangolo da misurare e quello del contenitore, non dell immagine:
    // da ingranditi l immagine e piu grande del riquadro per costruzione, ed e
    // il ritaglio a tenerla dentro. Misurare l <img> farebbe fallire il test
    // per un comportamento voluto.
    const riquadro = img.closest('figure > div') as HTMLElement
    const r = riquadro.getBoundingClientRect()
    return {
      w: r.width,
      h: r.height,
      caricata: img.complete && img.naturalWidth > 0,
      staDentro: r.width <= window.innerWidth && r.height <= window.innerHeight,
    }
  })

  // Un contenitore il cui unico figlio e in posizione assoluta non ha
  // larghezza intrinseca: senza una dimensione esplicita collassa a zero e la
  // lightbox si apre vuota, con i soli pulsanti e la didascalia.
  expect(misure.caricata).toBe(true)
  expect(misure.w).toBeGreaterThan(300)
  expect(misure.h).toBeGreaterThan(200)
  expect(misure.staDentro).toBe(true)
})
