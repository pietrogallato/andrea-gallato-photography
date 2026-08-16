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
