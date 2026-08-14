import { test, expect } from './fixtures'

/**
 * L unico test che parla davvero con cdn.sanity.io.
 *
 * Ovunque altrove le fotografie arrivano da un fixture locale (vedi
 * `e2e/fixtures.ts`): senza, una sola richiesta al CDN rimasta in sospeso
 * bloccava l evento `load` su WebKit e faceva scadere una navigazione a caso
 * della suite, con un messaggio che non nominava mai il colpevole.
 *
 * La verifica che le URL che costruiamo si risolvano per davvero non e pero da
 * buttare: vive qui, dove un CDN lento o irraggiungibile fa fallire un test che
 * lo dice, invece di avvelenare il primo test che passa di li.
 *
 * Usa `request` e non una pagina: non tocca alcun contesto del browser, quindi
 * il fixture locale non lo intercetta.
 */
test('le URL che costruiamo per il CDN si risolvono davvero', async ({ request }) => {
  const html = await (await request.get('/it/about')).text()

  // Il candidato scelto da WebKit su desktop per il ritratto: 38vw di 1280px.
  const srcset = html.match(/srcSet="([^"]+)"/i)?.[1]
  expect(srcset, 'la pagina About deve dichiarare un srcset per il ritratto').toBeTruthy()

  const url = srcset!.split(',')[0].trim().split(' ')[0].replace(/&amp;/g, '&')
  expect(url).toContain('cdn.sanity.io')

  const risposta = await request.get(url, { timeout: 20_000 })
  expect(risposta.status(), `cdn.sanity.io non ha servito ${url}`).toBe(200)
  expect(risposta.headers()['content-type']).toMatch(/^image\//)
})
