# Zoom nella lightbox — piano di implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: usare superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans per eseguire questo piano task per task. I passi
> usano caselle (`- [ ]`) per il tracciamento.

**Obiettivo.** Dentro la lightbox si può ingrandire una fotografia fino ai suoi pixel veri e
spostarsi in ogni direzione, con la pizzicata, la rotella, il doppio tocco, i pulsanti e la
tastiera.

**Architettura.** La matematica sta in un modulo puro (`lib/lightbox/zoom.ts`) perché in jsdom
la geometria non esiste e attraverso il componente non sarebbe verificabile. Lo stato sta in un
hook (`useZoom`), il collegamento agli eventi del DOM in un secondo hook (`useGestiZoom`).
L'ingrandimento si applica come `transform` sull'`<img>` interno tramite variabili CSS, mai sul
contenitore, che ha un'animazione con `fill-mode: both` che sequestrerebbe la proprietà.

**Stack.** Next.js 16.3, React 19.2.8, TypeScript strict, CSS Modules, Vitest 4 su jsdom 30,
Playwright 1.62.

**Documento normativo.** [`docs/superpowers/specs/2026-08-16-zoom-lightbox-design.md`](../specs/2026-08-16-zoom-lightbox-design.md)

---

## Convenzioni della casa, da rispettare in ogni task

- **TDD**: prima il test che fallisce, poi il minimo che lo fa passare.
- **Commenti in italiano che spiegano il perché**, non il cosa. Il codice dice già cosa fa.
- **Ogni costante misurata porta accanto la misura e la data.** Un numero nudo diventa
  un'ipotesi indiscutibile alla prima rilettura.
- **Niente accenti nei commenti e nei messaggi di commit** (il resto del codice li evita).
- Commit dopo ogni task.

---

## Struttura dei file

| file | responsabilità |
|---|---|
| `lib/lightbox/zoom.ts` | **nuovo.** Solo matematica, nessun DOM, nessun React. Tetto, vincolo dello spostamento, punto fisso, larghezza da chiedere. |
| `lib/lightbox/__tests__/zoom.test.ts` | **nuovo.** Copre ogni funzione del modulo. |
| `components/lightbox/useZoom.ts` | **nuovo.** Stato della vista, comandi, precarico del gradino successivo. Nessun listener del DOM. |
| `components/lightbox/useGestiZoom.ts` | **nuovo.** Solo collegamento agli eventi: puntatori, rotella non passiva, doppio tocco. |
| `components/lightbox/ZoomControls.tsx` | **nuovo.** I due pulsanti. |
| `components/lightbox/Lightbox.tsx` | integrazione: superficie, variabili CSS, ritiro dei comandi, ramo delle frecce, `Esc` a due tempi. |
| `components/lightbox/Lightbox.module.css` | `.superficie`, trasformazione sull'`<img>`, perimetro di `touch-action`, seconda barra. |
| `lib/i18n/dictionaries/{it,en}.ts` | tre chiavi nuove. |
| `e2e/zoom.spec.ts` | **nuovo.** Tastiera, Ctrl+rotella, doppio clic, axe da ingranditi, gradino chiesto. |
| `e2e/lightbox.spec.ts` | una asserzione spostata dall'`<img>` al contenitore. |
| `docs/verifiche/protocolli-verifiche-manuali.md` | la pizzicata su un telefono vero. |

`components/media/SanityImage.tsx` **non cambia.**

---

## Task 1: il tetto di ingrandimento

**File:**
- Creare: `lib/lightbox/zoom.ts`
- Test: `lib/lightbox/__tests__/zoom.test.ts`

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
// lib/lightbox/__tests__/zoom.test.ts
import { describe, it, expect } from 'vitest'
import { tettoDiIngrandimento, MOLTIPLICATORE_MINIMO } from '../zoom'

const GRANDE = 'https://cdn.sanity.io/images/p/d/abc-4000x2667.jpg'
const PICCOLA = 'https://cdn.sanity.io/images/p/d/abc-1080x1350.jpg'

describe('tettoDiIngrandimento', () => {
  it('deriva il tetto dai pixel nativi quando ce ne sono in abbondanza', () => {
    // 3840 disponibili (la scala si ferma li, non a 4000) su 960 dipinti.
    expect(tettoDiIngrandimento({ url: GRANDE, larghezzaDipintaCss: 480, dpr: 2 })).toBeCloseTo(4)
  })

  it('non supera mai l ultimo gradino della scala, nemmeno con un originale piu grande', () => {
    const tetto = tettoDiIngrandimento({ url: GRANDE, larghezzaDipintaCss: 100, dpr: 1 })
    expect(tetto).toBeCloseTo(38.4)
  })

  it('concede il minimo garantito dove i pixel veri non bastano', () => {
    // 1080 disponibili su 1116 dipinti: in pixel del dispositivo il margine e
    // sotto 1, cioe non esisterebbe alcun ingrandimento.
    expect(tettoDiIngrandimento({ url: PICCOLA, larghezzaDipintaCss: 558, dpr: 2 })).toBe(
      MOLTIPLICATORE_MINIMO,
    )
  })

  it('concede il minimo garantito quando il riquadro non e ancora stato misurato', () => {
    // In jsdom, e nel primo render prima del layout, la larghezza e zero: senza
    // questa guardia il tetto sarebbe Infinity.
    expect(tettoDiIngrandimento({ url: GRANDE, larghezzaDipintaCss: 0, dpr: 2 })).toBe(
      MOLTIPLICATORE_MINIMO,
    )
  })

  it('non si fida di un URL senza dimensioni: usa l ultimo gradino', () => {
    const tetto = tettoDiIngrandimento({
      url: 'https://cdn.sanity.io/images/p/d/senza-dimensioni.jpg',
      larghezzaDipintaCss: 960,
      dpr: 1,
    })
    expect(tetto).toBeCloseTo(4)
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: FAIL, «Failed to resolve import "../zoom"».

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
// lib/lightbox/zoom.ts
import { WIDTH_LADDER, parseAssetDimensions } from '@/lib/sanity/imageUrl'

/**
 * Quanto si concede comunque, anche dove i pixel veri non ci sono.
 *
 * **Misura del 16 agosto 2026:** dodici delle ventiquattro fotografie del
 * dataset sono esportazioni 1080x1350. Su uno schermo retina la lightbox le
 * dipinge su circa 1116 pixel del dispositivo e ne riceve 1080: in pixel veri
 * il margine e sotto 1, quindi il criterio rigoroso avrebbe spento la funzione
 * su meta archivio. A 2x, 1080 pixel distesi su 1860 restano lontani dal
 * vedersi sgranati.
 *
 * Il rimedio vero e a monte: riesportando quelle dodici a lato lungo 3000-4000
 * px questo minimo smette di entrare in gioco da solo.
 */
export const MOLTIPLICATORE_MINIMO = 2

const LARGHEZZA_MASSIMA = WIDTH_LADDER[WIDTH_LADDER.length - 1]

export type Punto = { x: number; y: number }
export type Riquadro = { larghezza: number; altezza: number }

/**
 * Il tetto di quella fotografia: il maggiore fra i suoi pixel veri e il minimo
 * garantito.
 *
 * I pixel disponibili si leggono dalle dimensioni native nell'URL dell'asset,
 * **non** dal parametro `w=` ne da `snapWidth`: entrambi agganciano alla scala
 * delle larghezze e sovrastimerebbero il nativo fino a un gradino intero,
 * facendoci ingrandire oltre i pixel veri.
 *
 * Il conto va fatto in pixel del dispositivo. Su uno schermo retina la stessa
 * larghezza CSS ne consuma il doppio, ed e la ragione per cui il margine
 * apparente sparisce appena si guarda lo schermo giusto.
 */
export function tettoDiIngrandimento({
  url,
  larghezzaDipintaCss,
  dpr,
}: {
  url: string
  larghezzaDipintaCss: number
  dpr: number
}): number {
  const dipinta = larghezzaDipintaCss * dpr
  if (dipinta <= 0) return MOLTIPLICATORE_MINIMO

  const native = parseAssetDimensions(url)
  const disponibili = native ? Math.min(native.width, LARGHEZZA_MASSIMA) : LARGHEZZA_MASSIMA

  return Math.max(disponibili / dipinta, MOLTIPLICATORE_MINIMO)
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: PASS, 5 test.

- [ ] **Passo 5: commit**

```bash
git add lib/lightbox/zoom.ts lib/lightbox/__tests__/zoom.test.ts
git commit -m "Ogni fotografia sa fin dove si lascia ingrandire"
```

---

## Task 2: il vincolo dello spostamento

**File:**
- Modificare: `lib/lightbox/zoom.ts`
- Test: `lib/lightbox/__tests__/zoom.test.ts`

Modello di coordinate, valido per tutto il piano: l'`<img>` riempie esattamente il riquadro
(W x H in pixel CSS). La trasformazione e `translate(tx, ty) scale(z)` con
`transform-origin: center`, quindi l'immagine viene disegnata grande `W*z` x `H*z`, centrata,
e poi spostata di `(tx, ty)` in pixel CSS non scalati. Perche non si aprano fessure ai bordi
lo spostamento non puo superare la meta della parte che sborda: `W*(z-1)/2` per asse.

- [ ] **Passo 1: scrivere il test che fallisce**

Aggiungere in coda a `lib/lightbox/__tests__/zoom.test.ts`:

```ts
import { limitaSpostamento } from '../zoom'

describe('limitaSpostamento', () => {
  const riquadro = { larghezza: 800, altezza: 600 }

  it('a riposo non lascia spostare di un pixel', () => {
    expect(limitaSpostamento({ pan: { x: 50, y: 50 }, livello: 1, riquadro })).toEqual({ x: 0, y: 0 })
  })

  it('lascia passare uno spostamento dentro i limiti', () => {
    // A livello 2 la meta che sborda vale 400 in orizzontale e 300 in verticale.
    expect(limitaSpostamento({ pan: { x: 120, y: -80 }, livello: 2, riquadro })).toEqual({
      x: 120,
      y: -80,
    })
  })

  it('taglia lo spostamento che aprirebbe una fessura', () => {
    expect(limitaSpostamento({ pan: { x: 999, y: -999 }, livello: 2, riquadro })).toEqual({
      x: 400,
      y: -300,
    })
  })

  it('non si lascia confondere da un riquadro non misurato', () => {
    expect(
      limitaSpostamento({ pan: { x: 10, y: 10 }, livello: 3, riquadro: { larghezza: 0, altezza: 0 } }),
    ).toEqual({ x: 0, y: 0 })
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: FAIL, «limitaSpostamento is not a function».

- [ ] **Passo 3: scrivere l'implementazione minima**

Aggiungere in coda a `lib/lightbox/zoom.ts`:

```ts
function fra(valore: number, minimo: number, massimo: number): number {
  return Math.min(Math.max(valore, minimo), massimo)
}

/**
 * Tiene la fotografia attaccata ai bordi del riquadro.
 *
 * Senza questo vincolo si potrebbe trascinare l'immagine fuori scena e restare
 * a guardare lo sfondo, che e il modo piu rapido di far sembrare rotto un
 * visualizzatore.
 */
export function limitaSpostamento({
  pan,
  livello,
  riquadro,
}: {
  pan: Punto
  livello: number
  riquadro: Riquadro
}): Punto {
  const massimoX = (riquadro.larghezza * (livello - 1)) / 2
  const massimoY = (riquadro.altezza * (livello - 1)) / 2
  return {
    x: fra(pan.x, -massimoX, massimoX),
    y: fra(pan.y, -massimoY, massimoY),
  }
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: PASS, 9 test.

- [ ] **Passo 5: commit**

```bash
git add lib/lightbox/zoom.ts lib/lightbox/__tests__/zoom.test.ts
git commit -m "La fotografia ingrandita non si stacca dai bordi"
```

---

## Task 3: il punto fisso

**File:**
- Modificare: `lib/lightbox/zoom.ts`
- Test: `lib/lightbox/__tests__/zoom.test.ts`

Ingrandendo sul punto dove si e messo il dito, quel punto della fotografia deve restare
esattamente dov'era. Un punto a distanza `p` dal centro corrisponde alla coordinata
`(p - pan) / z` sull'immagine; perche resti fermo passando a `z'`, il nuovo spostamento e
`p - (p - pan) * (z' / z)`.

- [ ] **Passo 1: scrivere il test che fallisce**

Aggiungere in coda a `lib/lightbox/__tests__/zoom.test.ts`:

```ts
import { spostamentoPerPuntoFisso, puntoRispettoAlCentro } from '../zoom'

describe('spostamentoPerPuntoFisso', () => {
  it('ingrandendo esattamente al centro non sposta nulla', () => {
    expect(
      spostamentoPerPuntoFisso({
        punto: { x: 0, y: 0 },
        livelloVecchio: 1,
        livelloNuovo: 2,
        panVecchio: { x: 0, y: 0 },
      }),
    ).toEqual({ x: 0, y: 0 })
  })

  it('tiene fermo il punto scelto raddoppiando', () => {
    // Il punto sta 100px a destra del centro. Raddoppiando, la fotografia va
    // spostata di 100px a sinistra perche quel punto resti sotto il dito.
    expect(
      spostamentoPerPuntoFisso({
        punto: { x: 100, y: 40 },
        livelloVecchio: 1,
        livelloNuovo: 2,
        panVecchio: { x: 0, y: 0 },
      }),
    ).toEqual({ x: -100, y: -40 })
  })

  it('tiene conto dello spostamento gia in essere', () => {
    expect(
      spostamentoPerPuntoFisso({
        punto: { x: 100, y: 0 },
        livelloVecchio: 2,
        livelloNuovo: 4,
        panVecchio: { x: 50, y: 0 },
      }),
    ).toEqual({ x: 0, y: 0 })
  })

  it('e reversibile: tornare al livello di partenza riporta allo spostamento di partenza', () => {
    const punto = { x: 73, y: -29 }
    const andata = spostamentoPerPuntoFisso({
      punto,
      livelloVecchio: 1,
      livelloNuovo: 3,
      panVecchio: { x: 0, y: 0 },
    })
    const ritorno = spostamentoPerPuntoFisso({
      punto,
      livelloVecchio: 3,
      livelloNuovo: 1,
      panVecchio: andata,
    })
    expect(ritorno.x).toBeCloseTo(0)
    expect(ritorno.y).toBeCloseTo(0)
  })
})

describe('puntoRispettoAlCentro', () => {
  it('traduce le coordinate del puntatore in coordinate del riquadro', () => {
    expect(
      puntoRispettoAlCentro({
        cliente: { x: 500, y: 300 },
        rettangolo: { left: 100, top: 100, larghezza: 800, altezza: 600 },
      }),
    ).toEqual({ x: 0, y: -100 })
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: FAIL, «spostamentoPerPuntoFisso is not a function».

- [ ] **Passo 3: scrivere l'implementazione minima**

Aggiungere in coda a `lib/lightbox/zoom.ts`:

```ts
/**
 * Lo spostamento che tiene fermo un punto mentre il livello cambia.
 *
 * Senza, la fotografia si ingrandisce sempre verso il centro e chi voleva
 * guardare un angolo deve inseguirlo trascinando: e la differenza fra uno zoom
 * che si usa e uno che si combatte.
 *
 * `punto` e in coordinate del riquadro rispetto al suo centro.
 */
export function spostamentoPerPuntoFisso({
  punto,
  livelloVecchio,
  livelloNuovo,
  panVecchio,
}: {
  punto: Punto
  livelloVecchio: number
  livelloNuovo: number
  panVecchio: Punto
}): Punto {
  const rapporto = livelloNuovo / livelloVecchio
  return {
    x: punto.x - (punto.x - panVecchio.x) * rapporto,
    y: punto.y - (punto.y - panVecchio.y) * rapporto,
  }
}

/** Dalle coordinate del puntatore a quelle del riquadro, con l'origine al centro. */
export function puntoRispettoAlCentro({
  cliente,
  rettangolo,
}: {
  cliente: Punto
  rettangolo: { left: number; top: number; larghezza: number; altezza: number }
}): Punto {
  return {
    x: cliente.x - (rettangolo.left + rettangolo.larghezza / 2),
    y: cliente.y - (rettangolo.top + rettangolo.altezza / 2),
  }
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: PASS, 14 test.

- [ ] **Passo 5: commit**

```bash
git add lib/lightbox/zoom.ts lib/lightbox/__tests__/zoom.test.ts
git commit -m "Si ingrandisce dove hai messo il dito, non verso il centro"
```

---

## Task 4: quale gradino chiedere

**File:**
- Modificare: `lib/lightbox/zoom.ts`
- Test: `lib/lightbox/__tests__/zoom.test.ts`

Servono due valori diversi e non intercambiabili: la larghezza **in pixel del dispositivo**,
per costruire l'URL da precaricare, e la stringa `sizes` **in pixel CSS**, perche il browser
la moltiplica lui per il rapporto di pixel.

- [ ] **Passo 1: scrivere il test che fallisce**

Aggiungere in coda a `lib/lightbox/__tests__/zoom.test.ts`:

```ts
import { larghezzaDaChiedere, sizesPerLivello } from '../zoom'

describe('larghezzaDaChiedere', () => {
  it('aggancia alla scala delle larghezze, sempre verso l alto', () => {
    // 480 CSS x 2 di rapporto x 2 di livello = 1920, che e un gradino esatto.
    expect(larghezzaDaChiedere({ larghezzaDipintaCss: 480, dpr: 2, livello: 2 })).toBe(1920)
    // 500 x 2 x 1,5 = 1500, che cade fra 1280 e 1600.
    expect(larghezzaDaChiedere({ larghezzaDipintaCss: 500, dpr: 2, livello: 1.5 })).toBe(1600)
  })

  it('non supera l ultimo gradino della scala', () => {
    expect(larghezzaDaChiedere({ larghezzaDipintaCss: 1200, dpr: 3, livello: 4 })).toBe(3840)
  })
})

describe('sizesPerLivello', () => {
  it('dichiara la larghezza in pixel CSS, che il browser moltiplichera da se', () => {
    expect(sizesPerLivello({ larghezzaDipintaCss: 480, livello: 2 })).toBe('960px')
  })

  it('arrotonda: una frazione di pixel in un attributo sizes e rumore', () => {
    expect(sizesPerLivello({ larghezzaDipintaCss: 333.4, livello: 1.5 })).toBe('500px')
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: FAIL, «larghezzaDaChiedere is not a function».

- [ ] **Passo 3: scrivere l'implementazione minima**

In `lib/lightbox/zoom.ts` estendere l'import in cima:

```ts
import { WIDTH_LADDER, parseAssetDimensions, snapWidth } from '@/lib/sanity/imageUrl'
```

e aggiungere in coda:

```ts
/**
 * La larghezza da chiedere al CDN per un dato livello, in pixel del
 * dispositivo, gia agganciata alla scala.
 *
 * Serve a costruire l'URL da precaricare, e quell'URL va costruita con lo
 * stesso loader che riempie il srcset — `sanityImageLoader` — non con
 * `buildImageUrl` chiamata a mano: il loader aggiunge la qualita tarata, e
 * senza quel parametro si precaricherebbe un altro file sotto un'altra chiave
 * di cache, cioe un precaricamento che non risparmia niente.
 *
 * Chiedere piu dei pixel disponibili non spreca banda: la larghezza viene
 * comunque limitata ai pixel nativi dell'asset e torna il file nativo.
 */
export function larghezzaDaChiedere({
  larghezzaDipintaCss,
  dpr,
  livello,
}: {
  larghezzaDipintaCss: number
  dpr: number
  livello: number
}): number {
  return snapWidth(larghezzaDipintaCss * dpr * livello)
}

/**
 * L'attributo `sizes` per un dato livello, in pixel CSS.
 *
 * Non e la stessa cosa di `larghezzaDaChiedere`: `sizes` e in pixel CSS perche
 * il browser lo moltiplica lui per il rapporto di pixel prima di scegliere la
 * variante nel srcset. Passare qui una larghezza in pixel del dispositivo
 * farebbe scaricare il doppio del necessario su ogni schermo retina.
 */
export function sizesPerLivello({
  larghezzaDipintaCss,
  livello,
}: {
  larghezzaDipintaCss: number
  livello: number
}): string {
  return `${Math.round(larghezzaDipintaCss * livello)}px`
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run lib/lightbox/__tests__/zoom.test.ts`
Atteso: PASS, 18 test.

- [ ] **Passo 5: verificare che la scala del modulo e quella di Next coincidano**

Esegui:

```bash
node -e "const c=require('fs').readFileSync('next.config.ts','utf8');const g=n=>JSON.parse(c.match(new RegExp(n+': (\\\[[^\\\]]*\\\])'))[1]);const l=[...g('imageSizes'),...g('deviceSizes')].sort((a,b)=>a-b);const w=JSON.parse(require('fs').readFileSync('lib/sanity/imageUrl.ts','utf8').match(/WIDTH_LADDER = (\[[^\]]*\])/)[1]);console.log(JSON.stringify(l)===JSON.stringify(w)?'coincidono':'DIVERSE: '+l+' vs '+w)"
```

Atteso: `coincidono`. Se stampa `DIVERSE`, il browser sceglierebbe una variante che non
abbiamo precaricato e lo scambio non sarebbe istantaneo: fermarsi e segnalarlo.

- [ ] **Passo 6: commit**

```bash
git add lib/lightbox/zoom.ts lib/lightbox/__tests__/zoom.test.ts
git commit -m "Si chiede il gradino che serve, non il piu grande che esiste"
```

---

## Task 5: le etichette nelle due lingue

**File:**
- Modificare: `lib/i18n/dictionaries/it.ts:28`
- Modificare: `lib/i18n/dictionaries/en.ts:30`

- [ ] **Passo 1: aggiungere le chiavi in italiano**

In `lib/i18n/dictionaries/it.ts`, subito dopo `lightboxLoading`:

```ts
  lightboxZoomIn: 'Ingrandisci la fotografia',
  lightboxZoomOut: 'Riduci la fotografia',
  lightboxZoomReset: 'Torna a schermo intero',
```

- [ ] **Passo 2: aggiungere le stesse chiavi in inglese**

In `lib/i18n/dictionaries/en.ts`, subito dopo `lightboxLoading`:

```ts
  lightboxZoomIn: 'Zoom in',
  lightboxZoomOut: 'Zoom out',
  lightboxZoomReset: 'Fit to screen',
```

- [ ] **Passo 3: eseguire il test di parità**

Esegui: `npx vitest run lib/i18n/__tests__/dictionaries.test.ts`
Atteso: PASS. Il test confronta le chiavi delle due lingue: se ne manca una da un lato
fallisce con «expected [...] to deeply equal [...]».

- [ ] **Passo 4: commit**

```bash
git add lib/i18n/dictionaries/it.ts lib/i18n/dictionaries/en.ts
git commit -m "I comandi di ingrandimento parlano entrambe le lingue"
```

---

## Task 6: lo stato della vista

**File:**
- Creare: `components/lightbox/useZoom.ts`
- Test: `components/lightbox/__tests__/useZoom.test.tsx`

Un solo oggetto di stato per livello e spostamento: tenerli separati costringerebbe a
chiamare un `set` dentro l'updater dell'altro, che in modalita strict React esegue due volte.

- [ ] **Passo 1: scrivere il test che fallisce**

```tsx
// components/lightbox/__tests__/useZoom.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import sanityImageLoader from '@/lib/sanity/imageUrl.loader'
import { useZoom } from '../useZoom'

const GRANDE = 'https://cdn.sanity.io/images/p/d/abc-4000x2667.jpg'

/**
 * jsdom non fa layout: getBoundingClientRect torna tutti zeri. Senza un
 * riquadro finto ogni conto sarebbe degenere, e i test non direbbero nulla.
 */
function riquadroFinto(larghezza = 800, altezza = 600) {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ width: larghezza, height: altezza, left: 0, top: 0, right: larghezza, bottom: altezza, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return { current: el }
}

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useZoom', () => {
  it('parte a riposo', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    expect(result.current.livello).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  it('ingrandisce e riduce senza superare i limiti', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.ingrandisci())
    expect(result.current.livello).toBeGreaterThan(1)

    act(() => { for (let i = 0; i < 20; i++) result.current.riduci() })
    expect(result.current.livello).toBe(1)
  })

  it('non supera mai il tetto della fotografia', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => { for (let i = 0; i < 30; i++) result.current.ingrandisci() })
    expect(result.current.livello).toBeCloseTo(result.current.tetto)
  })

  it('a riposo non si sposta', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.sposta({ x: 100, y: 100 }))
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  it('da ingranditi si sposta, entro i bordi', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    act(() => result.current.sposta({ x: 9999, y: 0 }))
    expect(result.current.pan.x).toBe(400)
  })

  it('il doppio tocco fa da interruttore', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.alDoppioTocco({ x: 0, y: 0 }))
    expect(result.current.livello).toBe(2)
    act(() => result.current.alDoppioTocco({ x: 0, y: 0 }))
    expect(result.current.livello).toBe(1)
  })

  it('si azzera cambiando fotografia', () => {
    const riquadro = riquadroFinto()
    const { result, rerender } = renderHook(
      ({ id }) => useZoom({ id, url: GRANDE, riquadroRef: riquadro, sizesDiRiposo: '800px' }),
      { initialProps: { id: 'a' } },
    )
    act(() => result.current.versoLivello(3))
    expect(result.current.livello).toBe(3)

    rerender({ id: 'b' })
    expect(result.current.livello).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  /**
   * Il precaricamento vale solo se scarica la STESSA URL che il browser
   * chiedera dal srcset. Le due nascono in punti diversi del codice — questo
   * effetto da una parte, next/image dall'altra — e basta un parametro di
   * scarto perche siano due chiavi di cache: due scaricamenti, e in mezzo
   * l'istante di sgranato che tutto questo ballo esiste per togliere. Il test
   * le confronta invece di fidarsi.
   */
  it('precarica esattamente l URL che il srcset chiedera', async () => {
    vi.useFakeTimers()
    const chiesti: string[] = []
    class ImmagineFinta {
      set src(valore: string) {
        chiesti.push(valore)
      }
      decode() {
        return Promise.resolve()
      }
    }
    vi.stubGlobal('Image', ImmagineFinta)

    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    // 800 CSS x 1 di rapporto x 2 di livello = 1600, un gradino esatto.
    expect(chiesti).toEqual([sanityImageLoader({ src: GRANDE, width: 1600 })])
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run components/lightbox/__tests__/useZoom.test.tsx`
Atteso: FAIL, «Failed to resolve import "../useZoom"».

- [ ] **Passo 3: scrivere l'implementazione minima**

```ts
// components/lightbox/useZoom.ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  larghezzaDaChiedere,
  limitaSpostamento,
  sizesPerLivello,
  spostamentoPerPuntoFisso,
  tettoDiIngrandimento,
  MOLTIPLICATORE_MINIMO,
  type Punto,
  type Riquadro,
} from '@/lib/lightbox/zoom'
import sanityImageLoader from '@/lib/sanity/imageUrl.loader'

/**
 * Quanto ingrandisce un colpo di `+` o del pulsante.
 *
 * 1,6 e un compromesso: con 2 si arriva al tetto in due colpi e la scala e
 * grossolana, con 1,2 servono otto pressioni per raddoppiare.
 */
const PASSO = 1.6

/** Dove porta il doppio tocco. E sempre raggiungibile: e anche il minimo garantito del tetto. */
const LIVELLO_DOPPIO_TOCCO = MOLTIPLICATORE_MINIMO

/**
 * Quanto si sta fermi prima di chiedere alla rete.
 *
 * Durante la pizzicata l'immagine si muove e la nitidezza non e giudicabile;
 * scaricare in quel momento ruberebbe banda e lavoro al gesto. Si aspetta che
 * il gesto sia finito.
 */
const RIPOSO_MS = 200

/** La stessa soglia dell'attesa gia esistente: sotto, l'indicatore lampeggerebbe. */
const INDICATORE_MS = 300

export type Vista = { livello: number; pan: Punto }

export function useZoom({
  id,
  url,
  riquadroRef,
  sizesDiRiposo,
}: {
  id: string
  url: string
  riquadroRef: { current: HTMLElement | null }
  sizesDiRiposo: string
}) {
  const [vista, setVista] = useState<Vista>({ livello: 1, pan: { x: 0, y: 0 } })
  const [tetto, setTetto] = useState(MOLTIPLICATORE_MINIMO)
  const [sizes, setSizes] = useState(sizesDiRiposo)
  const [attesa, setAttesa] = useState(false)

  /** Il gradino piu grande gia ottenuto: non si torna mai indietro riducendo. */
  const massimoChiesto = useRef(0)

  const misura = useCallback((): Riquadro | null => {
    const el = riquadroRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { larghezza: r.width, altezza: r.height }
  }, [riquadroRef])

  // Cambiando fotografia si torna a schermo intero. Senza, si arriverebbe
  // sulla successiva gia ingranditi in un punto che non ha senso per lei.
  useEffect(() => {
    setVista({ livello: 1, pan: { x: 0, y: 0 } })
    setSizes(sizesDiRiposo)
    setAttesa(false)
    massimoChiesto.current = 0
  }, [id, sizesDiRiposo])

  // Il tetto dipende da quanto grande viene dipinta la fotografia, che cambia
  // col ridimensionamento della finestra.
  useEffect(() => {
    function ricalcola() {
      const r = misura()
      setTetto(
        tettoDiIngrandimento({
          url,
          larghezzaDipintaCss: r?.larghezza ?? 0,
          dpr: window.devicePixelRatio || 1,
        }),
      )
    }
    ricalcola()
    window.addEventListener('resize', ricalcola)
    return () => window.removeEventListener('resize', ricalcola)
  }, [url, misura])

  /**
   * Il calcolo di una nuova vista, fuori da React perche non dipenda da nulla
   * che possa essere stantio.
   */
  function applica(
    v: Vista,
    richiesto: number,
    punto: Punto | undefined,
    riquadro: Riquadro | null,
    limite: number,
  ): Vista {
    const livello = Math.min(Math.max(richiesto, 1), limite)
    if (!riquadro) return { livello, pan: { x: 0, y: 0 } }
    const grezzo = punto
      ? spostamentoPerPuntoFisso({
          punto,
          livelloVecchio: v.livello,
          livelloNuovo: livello,
          panVecchio: v.pan,
        })
      : { x: (v.pan.x * livello) / v.livello, y: (v.pan.y * livello) / v.livello }
    return { livello, pan: limitaSpostamento({ pan: grezzo, livello, riquadro }) }
  }

  const versoLivello = useCallback(
    (richiesto: number, punto?: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, richiesto, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  /**
   * Ingrandire di un fattore, non verso un livello assoluto.
   *
   * La differenza non e stilistica: leggendo `vista.livello` dalla chiusura,
   * due pressioni ravvicinate partirebbero entrambe dallo stesso valore e la
   * seconda non avrebbe alcun effetto. Qui il livello di partenza arriva
   * dall'updater, quindi le pressioni si compongono.
   */
  const perFattore = useCallback(
    (fattore: number, punto?: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, v.livello * fattore, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  const sposta = useCallback(
    (delta: Punto) => {
      const riquadro = misura()
      setVista((v) => {
        if (!riquadro) return v
        return {
          ...v,
          pan: limitaSpostamento({
            pan: { x: v.pan.x + delta.x, y: v.pan.y + delta.y },
            livello: v.livello,
            riquadro,
          }),
        }
      })
    },
    [misura],
  )

  const ingrandisci = useCallback(() => perFattore(PASSO), [perFattore])
  const riduci = useCallback(() => perFattore(1 / PASSO), [perFattore])
  const azzera = useCallback(() => versoLivello(1), [versoLivello])
  const alDoppioTocco = useCallback(
    (punto: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, v.livello > 1 ? 1 : LIVELLO_DOPPIO_TOCCO, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  // Il secondo scaricamento. Si precarica il gradino e si aspetta che sia
  // DECODIFICATO prima di alzare `sizes`: solo cosi il browser lo trova in
  // cache e cambia variante senza un istante di vuoto.
  useEffect(() => {
    if (vista.livello <= 1) return
    const riquadro = misura()
    if (!riquadro) return

    const dpr = window.devicePixelRatio || 1
    const larghezza = larghezzaDaChiedere({
      larghezzaDipintaCss: riquadro.larghezza,
      dpr,
      livello: vista.livello,
    })
    if (larghezza <= massimoChiesto.current) return

    let vivo = true
    let barra: ReturnType<typeof setTimeout> | undefined

    const avvio = setTimeout(() => {
      if (!vivo) return
      barra = setTimeout(() => { if (vivo) setAttesa(true) }, INDICATORE_MS)

      const img = new window.Image()
      // L'URL passa dallo stesso loader che riempie il srcset, non da
      // buildImageUrl a mano: il loader aggiunge la qualita tarata, e senza
      // quel parametro si precaricherebbe un file diverso sotto un'altra
      // chiave di cache. Il browser, alzato `sizes`, andrebbe comunque in rete
      // a prendere la variante buona — e il precaricamento avrebbe soltanto
      // raddoppiato i byte.
      img.src = sanityImageLoader({ src: url, width: larghezza })
      img
        .decode()
        .catch(() => {
          // Un gradino che non arriva non e un guasto da mostrare: resta a
          // schermo la variante di prima, che e comunque leggibile.
        })
        .finally(() => {
          clearTimeout(barra)
          if (!vivo) return
          massimoChiesto.current = larghezza
          setAttesa(false)
          setSizes(sizesPerLivello({ larghezzaDipintaCss: riquadro.larghezza, livello: vista.livello }))
        })
    }, RIPOSO_MS)

    return () => {
      vivo = false
      clearTimeout(avvio)
      clearTimeout(barra)
    }
  }, [vista.livello, url, misura])

  return {
    livello: vista.livello,
    pan: vista.pan,
    tetto,
    sizes,
    attesa,
    ingrandito: vista.livello > 1,
    alTetto: vista.livello >= tetto,
    versoLivello,
    sposta,
    ingrandisci,
    riduci,
    azzera,
    alDoppioTocco,
  }
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run components/lightbox/__tests__/useZoom.test.tsx`
Atteso: PASS, 8 test.

- [ ] **Passo 5: commit**

```bash
git add components/lightbox/useZoom.ts components/lightbox/__tests__/useZoom.test.tsx
git commit -m "Lo stato della vista, e il gradino che arriva quando ti fermi"
```

---

## Task 7: i due pulsanti

**File:**
- Creare: `components/lightbox/ZoomControls.tsx`
- Test: `components/lightbox/__tests__/ZoomControls.test.tsx`

- [ ] **Passo 1: scrivere il test che fallisce**

```tsx
// components/lightbox/__tests__/ZoomControls.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZoomControls } from '../ZoomControls'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

function monta(props: Partial<Parameters<typeof ZoomControls>[0]> = {}) {
  const onIngrandisci = vi.fn()
  const onRiduci = vi.fn()
  const onAzzera = vi.fn()
  render(
    <ZoomControls
      dict={dict}
      ingrandito={false}
      alTetto={false}
      onIngrandisci={onIngrandisci}
      onRiduci={onRiduci}
      onAzzera={onAzzera}
      {...props}
    />,
  )
  return { onIngrandisci, onRiduci, onAzzera }
}

describe('ZoomControls', () => {
  it('a riposo mostra solo il comando per ingrandire', () => {
    monta()
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('da ingranditi compare il ritorno a schermo intero', () => {
    monta({ ingrandito: true })
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
  })

  it('al tetto il comando per ingrandire e disabilitato', () => {
    // E' cosi che ci si accorge di essere arrivati: non c e alcun annuncio.
    monta({ ingrandito: true, alTetto: true })
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeDisabled()
  })

  it('chiama i comandi giusti', async () => {
    const { onIngrandisci, onAzzera } = monta({ ingrandito: true })
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    expect(onIngrandisci).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomReset }))
    expect(onAzzera).toHaveBeenCalled()
  })
})
```

- [ ] **Passo 2: eseguire il test e verificare che fallisca**

Esegui: `npx vitest run components/lightbox/__tests__/ZoomControls.test.tsx`
Atteso: FAIL, «Failed to resolve import "../ZoomControls"».

- [ ] **Passo 3: scrivere l'implementazione minima**

```tsx
// components/lightbox/ZoomControls.tsx
'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import styles from './Lightbox.module.css'

/**
 * A riposo c e un comando solo. Il ritorno a schermo intero compare quando
 * serve, ed e anche l unico segnale visibile che si e dentro l altro stato.
 *
 * Nessun annuncio del livello: la lightbox ha una sola regione live e dice la
 * posizione. Una seconda metterebbe due annunci in coda a ogni freccia, e chi
 * ascolta si sentirebbe dire lo zoom quando voleva sapere a che fotografia e.
 */
export function ZoomControls({
  dict,
  ingrandito,
  alTetto,
  onIngrandisci,
  onRiduci,
  onAzzera,
}: {
  dict: Dictionary
  ingrandito: boolean
  alTetto: boolean
  onIngrandisci: () => void
  onRiduci: () => void
  onAzzera: () => void
}) {
  return (
    <div className={styles.zoom}>
      {ingrandito ? (
        <button type="button" className={styles.zoomButton} onClick={onRiduci}>
          <span className="visually-hidden">{dict.lightboxZoomOut}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        className={styles.zoomButton}
        onClick={onIngrandisci}
        disabled={alTetto}
      >
        <span className="visually-hidden">{dict.lightboxZoomIn}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {ingrandito ? (
        <button type="button" className={styles.zoomButton} onClick={onAzzera}>
          <span className="visually-hidden">{dict.lightboxZoomReset}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
            <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
```

- [ ] **Passo 4: eseguire il test e verificare che passi**

Esegui: `npx vitest run components/lightbox/__tests__/ZoomControls.test.tsx`
Atteso: PASS, 4 test.

- [ ] **Passo 5: commit**

```bash
git add components/lightbox/ZoomControls.tsx components/lightbox/__tests__/ZoomControls.test.tsx
git commit -m "Due comandi, che compaiono quando hanno un senso"
```

---

## Task 8: il CSS

**File:**
- Modificare: `components/lightbox/Lightbox.module.css:51-58`

La trasformazione va sull'`<img>` interno e non sul contenitore. **Misurato in Chromium 148:**
la classe `.image` ha `animation: reveal ... both`, e con `fill-mode: both` il valore animato
resta in vigore prima e dopo — uno `scale()` scritto li produce una computed transform pari
all'identita, cioe nessun effetto visibile.

- [ ] **Passo 1: sostituire il blocco `.image`**

Sostituire le righe 47-58 di `components/lightbox/Lightbox.module.css` con:

```css
/* La superficie e cio che si misura, cio che riceve i gesti e cio che porta le
   variabili dell ingrandimento. Il ritaglio invece resta al contenitore di
   SanityImage, che ha gia overflow: hidden e il rapporto giusto. */
.superficie {
  width: min(100%, calc(78dvh * var(--ar)));
  max-height: 78dvh;
  /* `none` solo qui: la pizzicata su questa superficie e nostra. Su didascalia,
     pulsanti e margini resta quella del browser, che ingrandisce la pagina ed e
     il modo con cui chi ci vede poco legge una didascalia piccola (WCAG 1.4.4).
     Il perimetro e la ragione per cui la deroga e accettabile. */
  touch-action: none;
}

.superficie:active {
  cursor: grabbing;
}

/* Il contenitore di SanityImage contiene solo un immagine in posizione
   assoluta, quindi non ha larghezza intrinseca: dentro un grid centrato
   collasserebbe a zero, e con esso l altezza derivata da aspect-ratio.
   Riempie la superficie, che la larghezza ce l ha. */
.image {
  width: 100%;
  /* La fotografia sale di poco entrando: il movimento e appena percettibile
     ma toglie alla lightbox l aria di finestra che compare di colpo. */
  animation: reveal var(--duration-slow) var(--ease-out) both;
  animation-delay: 40ms;
}

/* L ingrandimento vive qui, sull immagine, e non sul contenitore: quello ha
   l animazione d entrata con fill-mode `both`, che tiene sequestrata la
   proprieta transform. **Misurato in Chromium 148:** uno scale() inline su
   quell elemento da una computed transform pari all identita, cioe non entra
   mai in vigore.

   Una transizione CSS, non un animazione in JavaScript: la regola globale di
   prefers-reduced-motion azzera le durate CSS, e non saprebbe fermare un
   requestAnimationFrame. */
.superficie img {
  transform: translate(var(--pan-x, 0px), var(--pan-y, 0px)) scale(var(--zoom, 1));
  transition: transform var(--duration-fast) var(--ease-out);
}

/* Durante il gesto la transizione va tolta, altrimenti l immagine insegue il
   dito con un ritardo costante e sembra scollata. */
.superficie[data-gesto='true'] img {
  transition: none;
}
```

- [ ] **Passo 2: aggiungere lo stile dei comandi**

Aggiungere in coda a `components/lightbox/Lightbox.module.css`:

```css
.zoom {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  display: flex;
  gap: var(--space-2);
  z-index: 2;
}

.zoomButton {
  display: grid;
  place-items: center;
  /* Stessa area minima dei tre pulsanti gia presenti: un bersaglio piu piccolo
     accanto a tre che rispettano il minimo e una incoerenza visibile prima
     ancora che un problema di accessibilita. */
  min-width: var(--target-min);
  min-height: var(--target-min);
  color: var(--fg-muted);
  background: color-mix(in oklab, var(--bg) 72%, transparent);
  border-radius: var(--radius);
  transition: color var(--duration-fast) var(--ease);
}

.zoomButton:hover {
  color: var(--fg);
}

.zoomButton:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  color: var(--fg);
}

.zoomButton:disabled {
  opacity: 0.2;
  cursor: default;
}

/* La seconda barra: identica a vedersi a quella dell attesa, ma guidata da uno
   stato suo. Riusare quello dell attesa dichiarerebbe occupata, con aria-busy,
   una fotografia che si sta guardando benissimo. */
.loaderZoom {
  composes: loader;
}
```

- [ ] **Passo 3: verificare che i test di `sizes.ts` reggano ancora**

Esegui: `npx vitest run lib/lightbox/__tests__/sizes.test.ts`
Atteso: PASS. Le costanti non cambiano: la larghezza dipinta resta
`min(100vw - 80px, 78dvh * ar)`, solo espressa su `.superficie` invece che su `.image`.

- [ ] **Passo 4: commit**

```bash
git add components/lightbox/Lightbox.module.css
git commit -m "L ingrandimento si applica dove la transform non e sequestrata"
```

---

## Task 9: integrare nella lightbox

**File:**
- Modificare: `components/lightbox/Lightbox.tsx`
- Test: `components/lightbox/__tests__/Lightbox.test.tsx`

- [ ] **Passo 1: scrivere i test che falliscono**

Aggiungere in coda a `components/lightbox/__tests__/Lightbox.test.tsx`:

```tsx
describe('Lightbox, ingrandimento', () => {
  function montaConRiquadro(index = 0, onClose = vi.fn(), onNavigate = vi.fn()) {
    render(
      <Lightbox
        photos={photos}
        index={index}
        locale="it"
        dict={dict}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    )
    // jsdom non fa layout: senza un riquadro finto ogni conto sarebbe degenere
    // e il livello non salirebbe mai sopra 1.
    const superficie = document.querySelector('dialog figure > div') as HTMLElement
    superficie.getBoundingClientRect = () =>
      ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    return { onClose, onNavigate, superficie }
  }

  it('espone il comando per ingrandire, unico modo da tastiera', () => {
    montaConRiquadro()
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeInTheDocument()
  })

  it('da ingranditi ritira frecce e didascalia', async () => {
    montaConRiquadro(0)
    expect(screen.getByRole('button', { name: dict.lightboxNext })).toBeInTheDocument()
    expect(screen.getByText('Nebbia')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))

    // Ritirate, non nascoste a meta: mostrare una freccia mentre la stessa
    // freccia della tastiera fa un altra cosa e una interfaccia che si smentisce.
    expect(screen.queryByRole('button', { name: dict.lightboxNext })).toBeNull()
    expect(screen.queryByText('Nebbia')).toBeNull()
  })

  it('a riposo le frecce navigano', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('da ingranditi le frecce non navigano piu: spostano', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('non tocca le frecce quando c e un modificatore: quello e il browser', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.keyboard('{Meta>}{ArrowRight}{/Meta}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('il tasto + ingrandisce e il tasto 0 riporta a schermo intero', async () => {
    montaConRiquadro(0)
    await userEvent.keyboard('+')
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
    await userEvent.keyboard('0')
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('accetta = oltre a +, perche su parecchi layout + richiede Shift', async () => {
    montaConRiquadro(0)
    await userEvent.keyboard('=')
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
  })

  it('cambiando fotografia torna a schermo intero', async () => {
    const { rerender } = render(
      <Lightbox photos={photos} index={0} locale="it" dict={dict} onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    const superficie = document.querySelector('dialog figure > div') as HTMLElement
    superficie.getBoundingClientRect = () =>
      ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()

    rerender(
      <Lightbox photos={photos} index={1} locale="it" dict={dict} onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('resta una sola regione live, che dice la posizione', async () => {
    montaConRiquadro(0)
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    // getByRole fallisce con "found multiple elements" se ne compare una seconda.
    expect(screen.getByRole('status')).toHaveTextContent('1')
  })
})
```

- [ ] **Passo 2: eseguire i test e verificare che falliscano**

Esegui: `npx vitest run components/lightbox/__tests__/Lightbox.test.tsx`
Atteso: FAIL, «Unable to find an accessible element with the role "button" and name
"Ingrandisci la fotografia"».

- [ ] **Passo 3: riscrivere `components/lightbox/Lightbox.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { sizesForLightbox } from '@/lib/lightbox/sizes'
import { LightboxCaption } from './LightboxCaption'
import { ZoomControls } from './ZoomControls'
import { useScrollLock } from './useScrollLock'
import { useZoom } from './useZoom'
import { useGestiZoom } from './useGestiZoom'
import styles from './Lightbox.module.css'

/**
 * Quanto si aspetta prima di dichiarare l'attesa.
 *
 * Una fotografia gia in cache arriva in pochi millisecondi: mostrare subito un
 * indicatore lo farebbe lampeggiare a ogni freccia. Sopra questa soglia,
 * invece, senza un segnale sembrerebbe che il tasto non abbia funzionato.
 */
const INDICATOR_DELAY_MS = 300

/** Di quanto spostano le frecce a fotografia ingrandita, in pixel CSS. */
const PASSO_FRECCIA_PX = 60

export function Lightbox({
  photos,
  index,
  locale,
  dict,
  onClose,
  onNavigate,
}: {
  photos: GalleryPhoto[]
  index: number
  locale: Locale
  dict: Dictionary
  onClose: () => void
  onNavigate: (next: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const superficieRef = useRef<HTMLDivElement>(null)
  const photo = photos[index]

  const [loaded, setLoaded] = useState(false)
  const [waitedEnough, setWaitedEnough] = useState(false)

  useScrollLock()

  const sizesDiRiposo = sizesForLightbox(photo.ar)
  const zoom = useZoom({ id: photo.id, url: photo.url, riquadroRef: superficieRef, sizesDiRiposo })
  const { inGesto } = useGestiZoom({ superficieRef, zoom })

  // Ogni cambio di fotografia riapre l'attesa. L'indicatore non compare
  // subito: sotto la soglia il caricamento e gia finito, e farlo lampeggiare
  // a ogni freccia sarebbe piu fastidioso del problema che risolve.
  useEffect(() => {
    setLoaded(false)
    setWaitedEnough(false)
    const timer = setTimeout(() => setWaitedEnough(true), INDICATOR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [photo.id])

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  // Un solo listener per i tasti: aggiungerne un secondo per lo zoom farebbe
  // agire le frecce due volte.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Ctrl e Cmd sono l'ingrandimento del browser, che WCAG 1.4.4 pretende
      // resti disponibile. Non si intercetta e non si annulla.
      if (event.ctrlKey || event.metaKey) return

      if (event.key === '+' || event.key === '=') return zoom.ingrandisci()
      if (event.key === '-') return zoom.riduci()
      if (event.key === '0') return zoom.azzera()

      // Lo stesso tasto ha due significati, ma i due stati sono visibilmente
      // diversi: a riposo la fotografia sta tutta dentro lo schermo, ingrandita
      // no, e le frecce disegnate sono sparite.
      if (zoom.ingrandito) {
        if (event.key === 'ArrowRight') return zoom.sposta({ x: -PASSO_FRECCIA_PX, y: 0 })
        if (event.key === 'ArrowLeft') return zoom.sposta({ x: PASSO_FRECCIA_PX, y: 0 })
        if (event.key === 'ArrowDown') return zoom.sposta({ x: 0, y: -PASSO_FRECCIA_PX })
        if (event.key === 'ArrowUp') return zoom.sposta({ x: 0, y: PASSO_FRECCIA_PX })
        return
      }

      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, photos.length, onNavigate, zoom])

  const position = `${index + 1} / ${photos.length}`
  const label = photo.title ? `${photo.title} — ${position}` : `${dict.lightboxLabel} — ${position}`

  const variabili = {
    '--ar': String(photo.ar),
    '--zoom': String(zoom.livello),
    '--pan-x': `${zoom.pan.x}px`,
    '--pan-y': `${zoom.pan.y}px`,
  } as React.CSSProperties

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={label}
      // onCancel, non onClose. `cancel` scatta solo su una richiesta di
      // chiusura dell utente (Esc); `close` scatta per qualunque chiusura,
      // inclusa la nostra in fase di smontaggio. Collegare `close` fa
      // smontare la lightbox subito dopo l apertura in sviluppo, dove React
      // monta due volte: effect apre, cleanup chiama close() accodando
      // l evento, il secondo effect riapre, e l evento accodato arriva e
      // chiude tutto. E il lampo che si vede cliccando una fotografia.
      //
      // `cancel` e annullabile, ed e cio che rende possibile Esc a due tempi
      // senza spostarsi su un keydown parallelo: da ingranditi si torna a
      // schermo intero, e solo da li si chiude.
      onCancel={(event) => {
        if (zoom.ingrandito) {
          event.preventDefault()
          zoom.azzera()
          return
        }
        onClose()
      }}
    >
      <div role="status" aria-live="polite" className="visually-hidden">
        {position}
      </div>

      {/* Icone con etichetta visivamente nascosta: il nome accessibile resta
          quello del dizionario, ma i lati della fotografia non portano piu
          righe di testo lunghe che le competevano. */}
      <button type="button" className={styles.close} onClick={onClose} autoFocus>
        <span className="visually-hidden">{dict.lightboxClose}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" strokeWidth="1.25">
          <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
        </svg>
      </button>

      {!loaded && waitedEnough ? (
        <div
          className={styles.loader}
          role="progressbar"
          aria-label={dict.lightboxLoading}
          // Nessun aria-valuenow: non sappiamo a che punto sia il
          // trasferimento, e dichiarare un valore falso e peggio che tacere.
        />
      ) : null}

      {/* La barra del secondo scaricamento e muta: in quel momento non si sta
          aspettando nulla, si sta per ricevere qualcosa di meglio. Dichiararlo
          con aria-busy direbbe che la fotografia non e disponibile mentre la
          si sta guardando benissimo. */}
      {zoom.attesa ? <div className={styles.loaderZoom} aria-hidden="true" /> : null}

      <figure className={styles.figure} aria-busy={!loaded}>
        <div
          ref={superficieRef}
          className={styles.superficie}
          style={variabili}
          data-gesto={inGesto ? 'true' : 'false'}
        >
          <SanityImage
            photo={{ url: photo.url, aspectRatio: photo.ar, lqip: photo.lqip, alt: photo.alt, altLang: photo.altLang }}
            sizes={zoom.sizes}
            locale={locale}
            className={styles.image}
            onLoad={() => setLoaded(true)}
          />
        </div>
        {zoom.ingrandito ? null : <LightboxCaption photo={photo} locale={locale} />}
      </figure>

      {zoom.ingrandito ? null : (
        <>
          <button
            type="button"
            className={styles.prev}
            onClick={() => onNavigate(index - 1)}
            disabled={index === 0}
          >
            <span className="visually-hidden">{dict.lightboxPrev}</span>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" strokeWidth="1.25">
              <path d="M15 4l-9 8 9 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.next}
            onClick={() => onNavigate(index + 1)}
            disabled={index === photos.length - 1}
          >
            <span className="visually-hidden">{dict.lightboxNext}</span>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" strokeWidth="1.25">
              <path d="M9 4l9 8-9 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      <ZoomControls
        dict={dict}
        ingrandito={zoom.ingrandito}
        alTetto={zoom.alTetto}
        onIngrandisci={zoom.ingrandisci}
        onRiduci={zoom.riduci}
        onAzzera={zoom.azzera}
      />
    </dialog>
  )
}
```

- [ ] **Passo 4: eseguire tutti i test della lightbox**

Esegui: `npx vitest run components/lightbox/`
Atteso: PASS. Il Task 10 crea `useGestiZoom`: fino ad allora l'import fallisce, quindi
**questo passo va eseguito dopo il Task 10**. Se si esegue il piano in ordine, saltare a
Task 10 e tornare qui.

- [ ] **Passo 5: commit**

```bash
git add components/lightbox/Lightbox.tsx components/lightbox/__tests__/Lightbox.test.tsx
git commit -m "Dentro la fotografia le frecce cambiano mestiere, e l interfaccia lo dice"
```

---

## Task 10: i gesti

**File:**
- Creare: `components/lightbox/useGestiZoom.ts`

Questo hook non ha test unitari: **misurato su jsdom 30.0.1 installato**, non esistono
`Element.prototype.setPointerCapture` ne il layout, quindi ogni asserzione girerebbe su
geometria nulla e non direbbe nulla. La copertura sta negli end-to-end del Task 11 per
rotella, doppio clic e tastiera, e nel protocollo manuale per la pizzicata.

- [ ] **Passo 1: scrivere l'implementazione**

```ts
// components/lightbox/useGestiZoom.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { puntoRispettoAlCentro, type Punto } from '@/lib/lightbox/zoom'
import type { useZoom } from './useZoom'

/** Entro quanto tempo e quanto spazio due tocchi valgono per un doppio tocco. */
const DOPPIO_MS = 300
const DOPPIO_PX = 30

/**
 * Quanto la rotella ingrandisce.
 *
 * L'esponenziale rende il gesto uniforme: la stessa rotazione moltiplica
 * sempre per lo stesso fattore, invece di sommare una costante che a livelli
 * alti si sente pochissimo e a livelli bassi strattona.
 */
const SENSIBILITA_ROTELLA = 250

export function useGestiZoom({
  superficieRef,
  zoom,
}: {
  superficieRef: { current: HTMLElement | null }
  zoom: ReturnType<typeof useZoom>
}) {
  const [inGesto, setInGesto] = useState(false)

  /**
   * L'oggetto restituito da useZoom e nuovo a ogni render. Metterlo fra le
   * dipendenze dell'effect farebbe smontare e rimontare tutti i listener
   * decine di volte al secondo durante una pizzicata, azzerando ogni volta la
   * mappa dei puntatori e la distanza iniziale: il gesto non funzionerebbe
   * affatto. I gestori leggono invece il valore fresco da questo ref, e
   * l'effect si aggancia una volta sola.
   */
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  })

  useEffect(() => {
    const el = superficieRef.current
    if (!el) return

    const puntatori = new Map<number, Punto>()
    let distanzaIniziale = 0
    let livelloIniziale = 1
    let ultimo: Punto | null = null
    let ultimoTocco = { tempo: 0, x: 0, y: 0 }

    function relativo(x: number, y: number): Punto {
      const r = el!.getBoundingClientRect()
      return puntoRispettoAlCentro({
        cliente: { x, y },
        rettangolo: { left: r.left, top: r.top, larghezza: r.width, altezza: r.height },
      })
    }

    function distanza(): number {
      const [a, b] = [...puntatori.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    function centro(): Punto {
      const [a, b] = [...puntatori.values()]
      return relativo((a.x + b.x) / 2, (a.y + b.y) / 2)
    }

    function giu(event: PointerEvent) {
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })
      el!.setPointerCapture(event.pointerId)

      if (puntatori.size === 2) {
        distanzaIniziale = distanza()
        livelloIniziale = zoomRef.current.livello
        ultimo = null
      } else if (puntatori.size === 1) {
        ultimo = { x: event.clientX, y: event.clientY }
      }
      setInGesto(true)
    }

    function muovi(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (puntatori.size === 2 && distanzaIniziale > 0) {
        zoomRef.current.versoLivello((livelloIniziale * distanza()) / distanzaIniziale, centro())
        return
      }

      if (puntatori.size === 1 && ultimo && zoomRef.current.ingrandito) {
        zoomRef.current.sposta({ x: event.clientX - ultimo.x, y: event.clientY - ultimo.y })
        ultimo = { x: event.clientX, y: event.clientY }
      }
    }

    function su(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return

      // Doppio tocco, riconosciuto a mano invece che con `dblclick`: con
      // touch-action `none` il doppio tocco non e garantito arrivare come
      // dblclick su tutti i motori, e cosi mouse e dito seguono la stessa
      // strada, che e anche l unica che Playwright sa esercitare.
      const ora = event.timeStamp
      const vicino =
        Math.abs(event.clientX - ultimoTocco.x) < DOPPIO_PX &&
        Math.abs(event.clientY - ultimoTocco.y) < DOPPIO_PX
      if (puntatori.size === 1 && ora - ultimoTocco.tempo < DOPPIO_MS && vicino) {
        zoomRef.current.alDoppioTocco(relativo(event.clientX, event.clientY))
        ultimoTocco = { tempo: 0, x: 0, y: 0 }
      } else {
        ultimoTocco = { tempo: ora, x: event.clientX, y: event.clientY }
      }

      puntatori.delete(event.pointerId)
      el!.releasePointerCapture(event.pointerId)
      if (puntatori.size < 2) distanzaIniziale = 0
      if (puntatori.size === 0) {
        ultimo = null
        setInGesto(false)
      }
    }

    // addEventListener a mano, non onWheel in JSX: **verificato nel sorgente
    // installato** (react-dom 19.2.8, cjs/react-dom-client.development.js
    // righe 19251-19270), React registra `wheel` come listener passivo, quindi
    // preventDefault verrebbe ignorato con un avviso in console — e la suite
    // pretende zero warning.
    function rotella(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) {
        // Sui trackpad la pizzicata arriva proprio cosi, come rotella con
        // ctrlKey: gestendo questo caso il gesto sul trackpad si ha gratis.
        event.preventDefault()
        const fattore = Math.exp(-event.deltaY / SENSIBILITA_ROTELLA)
        zoomRef.current.versoLivello(
          zoomRef.current.livello * fattore,
          relativo(event.clientX, event.clientY),
        )
        return
      }
      // Rotella nuda: a riposo non e nostra, da ingranditi sposta.
      if (!zoomRef.current.ingrandito) return
      event.preventDefault()
      zoomRef.current.sposta({ x: -event.deltaX, y: -event.deltaY })
    }

    el.addEventListener('pointerdown', giu)
    el.addEventListener('pointermove', muovi)
    el.addEventListener('pointerup', su)
    el.addEventListener('pointercancel', su)
    el.addEventListener('wheel', rotella, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', giu)
      el.removeEventListener('pointermove', muovi)
      el.removeEventListener('pointerup', su)
      el.removeEventListener('pointercancel', su)
      el.removeEventListener('wheel', rotella)
    }
    // Solo il ref: i valori freschi arrivano da zoomRef, e riagganciarsi a
    // ogni render romperebbe il gesto invece di aggiornarlo.
  }, [superficieRef])

  return { inGesto }
}
```

- [ ] **Passo 2: eseguire tutta la suite unitaria**

Esegui: `npm test`
Atteso: PASS su tutto, compresi i test del Task 9 che fino a ora non compilavano.

- [ ] **Passo 3: controllare i tipi**

Esegui: `npm run typecheck`
Atteso: nessun errore.

- [ ] **Passo 4: commit**

```bash
git add components/lightbox/useGestiZoom.ts
git commit -m "Pizzicata, rotella e doppio tocco, con la rotella non passiva"
```

---

## Task 11: gli end-to-end

**File:**
- Creare: `e2e/zoom.spec.ts`
- Modificare: `e2e/lightbox.spec.ts:82-116`

- [ ] **Passo 1: correggere l'asserzione che l'ingrandimento invaliderebbe**

In `e2e/lightbox.spec.ts`, dentro il test «mostra la fotografia a dimensione utile, dentro il
viewport», sostituire il blocco `page.evaluate` delle misure con:

```ts
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
```

- [ ] **Passo 2: eseguire il test corretto**

Esegui: `npx playwright test e2e/lightbox.spec.ts --project=chromium`
Atteso: PASS, 8 test.

- [ ] **Passo 3: scrivere i nuovi end-to-end**

```ts
// e2e/zoom.spec.ts
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

test('Ctrl e rotella ingrandiscono la fotografia', async ({ page }) => {
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
```

- [ ] **Passo 4: eseguire i nuovi end-to-end**

Esegui: `npx playwright test e2e/zoom.spec.ts --project=chromium`
Atteso: PASS, 8 test.

- [ ] **Passo 5: eseguire la suite completa su tutti i progetti**

Esegui: `npm run e2e`
Atteso: PASS su chromium, webkit, iphone e dev.

- [ ] **Passo 6: commit**

```bash
git add e2e/zoom.spec.ts e2e/lightbox.spec.ts
git commit -m "Tastiera, rotella e doppio clic sotto test; la pizzicata dichiarata fuori"
```

---

## Task 12: la verifica che resta a una persona

**File:**
- Modificare: `docs/verifiche/protocolli-verifiche-manuali.md`

- [ ] **Passo 1: aggiungere la terza verifica**

Aggiungere in coda a `docs/verifiche/protocolli-verifiche-manuali.md`:

```markdown
---

## 3. La pizzicata, su un telefono vero

**Perché non è automatizzabile.** `Touchscreen` di Playwright dichiara di emulare soltanto
i gesti di tap; il progetto `iphone` gira su WebKit, quindi non c'è un CDP a cui ripiegare;
e i `TouchEvent` costruiti a mano non generano Pointer Events. Rotella, doppio clic e
tastiera sono sotto test in `e2e/zoom.spec.ts`. La pizzicata no, e non lo sarà.

Su un telefono, aperta una fotografia in galleria:

1. **pizzicare sulla fotografia** e verificare che si ingrandisca lei, non la pagina;
2. **trascinare** e verificare che ci si sposti in tutte le direzioni senza che si aprano
   fessure ai bordi;
3. **doppio tocco** e verificare che porti al doppio e che un secondo doppio tocco torni
   a schermo intero;
4. **pizzicare sulla didascalia**, fuori dalla fotografia, e verificare che lì ingrandisca
   ancora la pagina: è il perimetro dichiarato, ed è ciò che tiene in piedi WCAG 1.4.4;
5. **arrivare al tetto** su una fotografia grande e su una da 1080 px, e guardare se
   l'immagine resta accettabile o si vede sgranata. Se si vede, il minimo garantito di 2×
   in `lib/lightbox/zoom.ts` va rivisto — annotando la misura.

### Cosa fare dei risultati

Come per le altre due: pagina, gesto e cosa si è visto. «Lo zoom è strano» non è
riproducibile e finirà per non essere corretto.
```

- [ ] **Passo 2: commit**

```bash
git add docs/verifiche/protocolli-verifiche-manuali.md
git commit -m "La pizzicata entra fra le prove che vogliono una persona"
```

---

## Task 13: verifica finale

**File:** nessuno.

- [ ] **Passo 1: suite unitaria completa**

Esegui: `npm test`
Atteso: PASS. Prima di questo lavoro erano 357 verdi più 4 che si disattivano da soli;
adesso devono essere almeno 357 + 18 (zoom.ts) + 7 (useZoom) + 4 (ZoomControls) + 9
(Lightbox) = 395.

- [ ] **Passo 2: tipi**

Esegui: `npm run typecheck`
Atteso: nessun errore.

- [ ] **Passo 3: build di produzione**

Esegui: `npm run build`
Atteso: build completata senza avvisi di `next/image` sul nuovo `sizes`.

- [ ] **Passo 4: suite end-to-end completa**

Esegui: `npm run e2e`
Atteso: PASS su tutti e quattro i progetti. In particolare `console.dev.spec.ts` deve
restare verde: pretende zero errori e zero avvisi di console, ed è ciò che coglierebbe un
listener registrato passivo per errore.

- [ ] **Passo 5: commit finale se qualcosa è stato corretto**

```bash
git add -A
git commit -m "Verifiche finali dello zoom"
```
