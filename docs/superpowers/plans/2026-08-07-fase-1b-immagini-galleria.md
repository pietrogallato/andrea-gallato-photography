# Fase 1B — Immagini, galleria e lightbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere visibili le fotografie: pipeline immagini servita dal CDN Sanity, galleria a righe giustificate calcolate lato server, caricamento incrementale, lightbox accessibile e fotografia protagonista in homepage.

**Architecture:** Le larghezze delle immagini vengono da una scala fissa configurata in `next.config.ts` e prodotte da un loader custom che punta al CDN di Sanity, così Vercel non riottimizza nulla. La composizione delle righe della galleria è calcolata da una funzione pura lato server a partire dai rapporti d'aspetto già noti da Sanity, il che la rende indipendente dalla larghezza del viewport e rende calcolabile l'attributo `sizes`. La lightbox è costruita sul `<dialog>` nativo, che fornisce inertizzazione, `aria-modal` ed Esc a cura del browser.

**Tech Stack:** Next 16.3, React 19.2, TypeScript strict, Sanity 6.9, CSS Modules, Vitest + Testing Library, Playwright.

**Documenti normativi:**
- [Design implementativo](../specs/2026-08-07-portfolio-fotografico-design.md) — §6 pipeline immagini, §7 galleria e packer, §9 lightbox
- [Specifica di prodotto](../../../portfolio-fotografico-design.md) — §8.2 homepage, §8.3 galleria, §9 lightbox, §11 qualità immagini, §13 accessibilità

**Prerequisito:** la Fase 1A è completa e il dataset `development` è popolato dal seed. Senza fotografie nel dataset, i task da 6 in poi non sono verificabili.

**Fuori ambito in 1B** (vanno in Fase 2): pagine progetto, About, canonical e `hreflang`, sitemap, robots, webhook di revalidation.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `next.config.ts` (modifica) | `images.loader`, `loaderFile`, `deviceSizes`, `imageSizes` |
| `lib/sanity/imageUrl.ts` | `snapWidth`, `buildImageUrl` — modulo puro, condiviso server e client |
| `lib/sanity/imageLoader.ts` | Default export del loader per `next/image`. Modulo **client** |
| `components/media/SanityImage.tsx` | Incapsula `next/image`: `sizes` obbligatorio, `aspect-ratio`, LQIP, stato di errore |
| `lib/gallery/packRows.ts` | `packRows(items, K)` — composizione delle righe, funzione pura |
| `lib/gallery/sizes.ts` | `sizesForTile(row, index)` — attributo `sizes` per tile |
| `lib/sanity/queries.ts` (modifica) | `galleryPageQuery`, `galleryCountQuery`, `homeHeroQuery` |
| `views/GalleryView.tsx` | Pagina galleria: query, packer, griglia, pulsante |
| `components/gallery/PhotoGrid.tsx` | Rende le righe impaccate |
| `components/gallery/PhotoRow.tsx` | Una riga flex |
| `components/gallery/PhotoTile.tsx` | `<button>` che apre la lightbox |
| `components/gallery/LoadMoreButton.tsx` | Client: append, stato, regione di stato, gestione del focus |
| `app/actions/loadMorePhotos.ts` | Server Action: gruppo successivo già impaccato |
| `components/lightbox/Lightbox.tsx` | `<dialog>` + `showModal()` |
| `components/lightbox/LightboxCaption.tsx` | Titolo, anno, luogo, con `lang` sul fallback |
| `components/lightbox/useSwipe.ts` | Gesti, con soglie per asse |
| `components/lightbox/useScrollLock.ts` | Blocco scroll iOS-safe |
| `components/gallery/GalleryClient.tsx` | Client: possiede lo stato di lightbox e append |
| `views/HomeView.tsx` (modifica) | Fotografia protagonista |
| `components/layout/MobileMenu.tsx` | Menu compatto sotto il breakpoint |

---

## Task 1: Configurare la pipeline immagini

**Files:**
- Modify: `next.config.ts`
- Create: `lib/sanity/imageUrl.ts`, `lib/sanity/imageLoader.ts`
- Test: `lib/sanity/__tests__/imageUrl.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/sanity/__tests__/imageUrl.test.ts
import { describe, it, expect } from 'vitest'
import { WIDTH_LADDER, snapWidth, buildImageUrl, parseAssetDimensions } from '../imageUrl'

const SRC = 'https://cdn.sanity.io/images/xpdypayk/development/abc123-4000x3000.jpg'

describe('snapWidth', () => {
  it('arrotonda per eccesso alla larghezza superiore della scala', () => {
    expect(snapWidth(700)).toBe(828)
    expect(snapWidth(828)).toBe(828)
    expect(snapWidth(1)).toBe(WIDTH_LADDER[0])
  })

  it('non supera mai la larghezza massima della scala', () => {
    expect(snapWidth(99999)).toBe(WIDTH_LADDER[WIDTH_LADDER.length - 1])
  })

  it('restituisce solo valori appartenenti alla scala', () => {
    for (let w = 1; w <= 4000; w += 37) {
      expect(WIDTH_LADDER).toContain(snapWidth(w))
    }
  })

  it('restituisce sempre interi', () => {
    expect(Number.isInteger(snapWidth(700.5))).toBe(true)
  })
})

describe('parseAssetDimensions', () => {
  it('estrae le dimensioni native dall URL Sanity', () => {
    expect(parseAssetDimensions(SRC)).toEqual({ width: 4000, height: 3000 })
  })

  it('restituisce null quando l URL non le contiene', () => {
    expect(parseAssetDimensions('https://example.com/foto.jpg')).toBeNull()
  })
})

describe('buildImageUrl', () => {
  it('applica fit=max, che impedisce l upscaling lato CDN', () => {
    expect(buildImageUrl(SRC, 828)).toContain('fit=max')
  })

  it('applica auto=format per le richieste del browser', () => {
    expect(buildImageUrl(SRC, 828)).toContain('auto=format')
  })

  it('usa una larghezza della scala, mai quella richiesta se non vi appartiene', () => {
    expect(buildImageUrl(SRC, 700)).toContain('w=828')
    expect(buildImageUrl(SRC, 700)).not.toContain('w=700')
  })

  it('non emette mai dimensioni frazionarie', () => {
    expect(buildImageUrl(SRC, 700.5)).not.toMatch(/w=\d+\.\d+/)
  })

  it('non chiede mai piu della larghezza nativa dell asset', () => {
    // L asset e 4000px: una richiesta a 3840 resta, una oltre viene limitata.
    expect(buildImageUrl(SRC, 3840)).toContain('w=3840')
    const small = 'https://cdn.sanity.io/images/xpdypayk/development/abc-1000x800.jpg'
    expect(buildImageUrl(small, 3840)).toContain('w=1080')
  })

  it('fissa il formato quando richiesto, per i crawler', () => {
    const og = buildImageUrl(SRC, 1200, { format: 'jpg' })
    expect(og).toContain('fm=jpg')
    expect(og).not.toContain('auto=format')
  })

  it('accetta una qualita esplicita', () => {
    expect(buildImageUrl(SRC, 828, { quality: 85 })).toContain('q=85')
  })
})
```

Il penultimo test copre l'eccezione della §6: `auto=format` dipende dall'header `Accept`, che gli scraper social non mandano in modo affidabile, quindi gli URL destinati ai crawler fissano il formato.

L'ultimo gruppo merita una nota: il divieto di upscaling è garantito **lato CDN** da `fit=max`. Il clamp alla larghezza nativa è un'ottimizzazione aggiuntiva — evita di richiedere varianti che il CDN comunque non produrrebbe — e si ricava dal nome dell'asset, che contiene le dimensioni.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/sanity/__tests__/imageUrl.test.ts
```

Atteso: FAIL, `Failed to resolve import "../imageUrl"`.

- [ ] **Step 3: Scrivere `lib/sanity/imageUrl.ts`**

```ts
export const WIDTH_LADDER = [320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560, 3840] as const

const MAX_WIDTH = WIDTH_LADDER[WIDTH_LADDER.length - 1]

export function snapWidth(requested: number): number {
  const target = Math.ceil(requested)
  return WIDTH_LADDER.find((w) => w >= target) ?? MAX_WIDTH
}

/** Gli URL degli asset Sanity contengono le dimensioni native: `<id>-4000x3000.jpg`. */
export function parseAssetDimensions(src: string): { width: number; height: number } | null {
  const match = src.match(/-(\d+)x(\d+)\.\w+/)
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}

export type ImageUrlOptions = {
  quality?: number
  /** Fissa il formato invece di negoziarlo. Per i crawler, che non mandano Accept. */
  format?: 'jpg' | 'png' | 'webp'
}

export function buildImageUrl(src: string, width: number, options: ImageUrlOptions = {}): string {
  const native = parseAssetDimensions(src)
  const capped = native ? Math.min(snapWidth(width), native.width) : snapWidth(width)
  const finalWidth = snapWidth(capped)

  const url = new URL(src)
  url.searchParams.set('w', String(finalWidth))
  url.searchParams.set('fit', 'max')

  if (options.format) {
    url.searchParams.set('fm', options.format)
  } else {
    url.searchParams.set('auto', 'format')
  }

  if (options.quality) url.searchParams.set('q', String(options.quality))

  return url.toString()
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run lib/sanity/__tests__/imageUrl.test.ts
```

Atteso: PASS, 12 test.

- [ ] **Step 5: Scrivere il loader**

```ts
// lib/sanity/imageLoader.ts
'use client'

import { buildImageUrl } from './imageUrl'

export default function sanityImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return buildImageUrl(src, width, { quality: quality ?? 85 })
}
```

`'use client'` è obbligatorio: il file del loader finisce nel bundle client. Per la stessa ragione **non deve importare nulla che tocchi variabili d'ambiente server o `lib/sanity/client.ts`** — trascinerebbe il token di lettura nel bundle pubblico, in contrasto con il design §14. `imageUrl.ts` è puro proprio per poter essere condiviso senza questo rischio.

La qualità 85 è il valore prudente della §17: va tarata su fotografie reali, non sui placeholder.

- [ ] **Step 6: Configurare `next.config.ts`**

Aggiungere la chiave `images` accanto a `redirects`:

```ts
  images: {
    loader: 'custom',
    loaderFile: './lib/sanity/imageLoader.ts',
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560, 3840],
    imageSizes: [320, 480],
  },
```

Senza questa configurazione Next chiede le sue larghezze di default (640, 750, 828, 1200, 2048…), che non coincidono con la scala: più larghezze collasserebbero sullo stesso URL arrotondato, producendo un `srcset` con voci duplicate e descrittori `w` che dichiarano una larghezza diversa da quella reale. Il browser sceglierebbe male e si scaricherebbero byte in più. È un bug silenzioso, non un errore di build.

I valori di `imageSizes` devono essere tutti minori del minimo di `deviceSizes`.

- [ ] **Step 7: Verificare**

```bash
npm run typecheck && npm run build
```

Atteso: nessun errore; le rotte restano prerenderizzate.

- [ ] **Step 8: Commit**

```bash
git add next.config.ts lib/sanity/imageUrl.ts lib/sanity/imageLoader.ts lib/sanity/__tests__/imageUrl.test.ts
git commit -m "feat: pipeline immagini con scala di larghezze fissa e loader Sanity"
```

---

## Task 2: `SanityImage`

**Files:**
- Create: `components/media/SanityImage.tsx`, `components/media/SanityImage.module.css`
- Test: `components/media/__tests__/SanityImage.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/media/__tests__/SanityImage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SanityImage } from '../SanityImage'

const photo = {
  url: 'https://cdn.sanity.io/images/xpdypayk/development/abc-4000x3000.jpg',
  aspectRatio: 4 / 3,
  lqip: 'data:image/jpeg;base64,/9j/placeholder',
  alt: 'Nebbia sul fiume',
  altLang: 'it' as const,
}

describe('SanityImage', () => {
  it('espone l alt text come nome accessibile', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img', { name: 'Nebbia sul fiume' })).toBeInTheDocument()
  })

  it('marca la lingua quando l alt viene dal fallback italiano', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="en" />)
    expect(screen.getByRole('img')).toHaveAttribute('lang', 'it')
  })

  it('non marca la lingua quando coincide con quella della pagina', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img')).not.toHaveAttribute('lang')
  })

  it('riserva lo spazio con aspect-ratio prima del caricamento', () => {
    const { container } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--ar')).toBe(String(4 / 3))
  })

  it('carica in lazy per impostazione predefinita', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })

  it('accetta la priorita esplicita per l unica immagine protagonista', () => {
    render(<SanityImage photo={photo} sizes="100vw" locale="it" priority />)
    expect(screen.getByRole('img')).not.toHaveAttribute('loading', 'lazy')
  })

  it('mostra un riquadro neutro con l alt se l immagine fallisce, senza perdere le dimensioni', () => {
    const { container } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    fireEvent.error(screen.getByRole('img'))

    expect(screen.getByText('Nebbia sul fiume')).toBeInTheDocument()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--ar')).toBe(String(4 / 3))
  })
})
```

L'ultimo test copre il requisito §12 della specifica di prodotto: se un'immagine non si carica, resta un riquadro neutro con il testo alternativo e **le dimensioni preservate**, così la pagina non si sposta.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run components/media/__tests__/SanityImage.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere il componente**

```tsx
// components/media/SanityImage.tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import sanityImageLoader from '@/lib/sanity/imageUrl.loader'
import styles from './SanityImage.module.css'

export type PhotoImage = {
  url: string
  aspectRatio: number
  lqip?: string | null
  alt: string
  altLang: Locale
}

export function SanityImage({
  photo,
  sizes,
  locale,
  priority = false,
  className,
}: {
  photo: PhotoImage
  sizes: string
  locale: Locale
  priority?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  const style = { '--ar': String(photo.aspectRatio) } as React.CSSProperties
  const lang = photo.altLang === locale ? undefined : photo.altLang

  if (failed) {
    return (
      <div className={`${styles.wrapper} ${styles.failed} ${className ?? ''}`} style={style}>
        <span className={styles.fallbackText} lang={lang}>
          {photo.alt}
        </span>
      </div>
    )
  }

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} style={style}>
      <Image
        loader={sanityImageLoader}
        src={photo.url}
        alt={photo.alt}
        lang={lang}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={photo.lqip ? 'blur' : 'empty'}
        blurDataURL={photo.lqip ?? undefined}
        onError={() => setFailed(true)}
        className={styles.image}
      />
    </div>
  )
}
```

**Il `loader` è passato esplicitamente come prop, non lasciato al solo `loaderFile`.** `loaderFile` è applicato da Next come alias del compiler, quindi non è attivo sotto Vitest: i test di componente renderebbero URL prodotti dal loader di default, cioè verdi su un comportamento che in produzione non esiste. Passandolo come prop, test, sviluppo e produzione si comportano allo stesso modo.

Serve quindi un modulo separato importabile anche dai test:

```ts
// lib/sanity/imageUrl.loader.ts
'use client'

import { buildImageUrl } from './imageUrl'

export default function sanityImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return buildImageUrl(src, width, { quality: quality ?? 85 })
}
```

e `lib/sanity/imageLoader.ts` del Task 1 diventa un semplice re-export, perché `next.config.ts` punta a quel percorso:

```ts
// lib/sanity/imageLoader.ts
export { default } from './imageUrl.loader'
```

- [ ] **Step 4: Scrivere il CSS**

```css
/* components/media/SanityImage.module.css */
.wrapper {
  position: relative;
  aspect-ratio: var(--ar);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-elevated);
}

.image {
  object-fit: cover;
}

.failed {
  display: grid;
  place-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border);
}

.fallbackText {
  color: var(--fg-muted);
  font-size: 0.875rem;
  text-align: center;
  max-width: 40ch;
}
```

`min-width: 0` e `overflow: hidden` non sono decorativi: senza, un elemento flex assume la larghezza intrinseca dell'immagine e sfonda la pagina orizzontalmente. Con il rapporto corretto `object-fit: cover` non ritaglia nulla e protegge solo da arrotondamenti sub-pixel.

- [ ] **Step 5: Eseguire e verificare che passi**

```bash
npx vitest run components/media/__tests__/SanityImage.test.tsx
```

Atteso: PASS, 7 test.

- [ ] **Step 6: Commit**

```bash
git add components/media lib/sanity/imageUrl.loader.ts lib/sanity/imageLoader.ts
git commit -m "feat: SanityImage con loader esplicito, LQIP e riquadro di errore"
```

---

## Task 3: `packRows`

**Files:**
- Create: `lib/gallery/packRows.ts`
- Test: `lib/gallery/__tests__/packRows.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/gallery/__tests__/packRows.test.ts
import { describe, it, expect } from 'vitest'
import { packRows, K_DESKTOP, K_TABLET } from '../packRows'

const item = (id: string, ar: number) => ({ id, ar })

describe('packRows', () => {
  it('restituisce nessuna riga per un elenco vuoto', () => {
    expect(packRows([], K_DESKTOP)).toEqual([])
  })

  it('mette un solo elemento in una sola riga', () => {
    const rows = packRows([item('a', 1.5)], K_DESKTOP)
    expect(rows).toHaveLength(1)
    expect(rows[0].items.map((i) => i.id)).toEqual(['a'])
  })

  it('non perde ne duplica alcun elemento', () => {
    const items = Array.from({ length: 37 }, (_, i) => item(`p${i}`, 1 + (i % 5) * 0.35))
    const rows = packRows(items, K_DESKTOP)
    const flat = rows.flatMap((r) => r.items.map((i) => i.id))

    expect(flat).toEqual(items.map((i) => i.id))
  })

  it('preserva l ordine editoriale', () => {
    const items = [item('a', 1.7), item('b', 0.7), item('c', 1.5), item('d', 1)]
    const flat = packRows(items, K_DESKTOP).flatMap((r) => r.items.map((i) => i.id))

    expect(flat).toEqual(['a', 'b', 'c', 'd'])
  })

  it('espone la somma dei rapporti di ciascuna riga', () => {
    const rows = packRows([item('a', 1.5), item('b', 1.5)], 3)
    expect(rows[0].sumAr).toBeCloseTo(3, 5)
  })

  it('marca l ultima riga, che non va giustificata', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`p${i}`, 1.5))
    const rows = packRows(items, K_DESKTOP)

    expect(rows[rows.length - 1].isLast).toBe(true)
    expect(rows.slice(0, -1).every((r) => r.isLast === false)).toBe(true)
  })

  it('avvicina la somma dei rapporti al bersaglio K', () => {
    const items = Array.from({ length: 40 }, () => item('x', 1.5))
    const rows = packRows(items, K_DESKTOP)
    const complete = rows.filter((r) => !r.isLast)

    for (const row of complete) {
      // Ogni riga completa sta entro mezzo rapporto medio dal bersaglio.
      expect(Math.abs(row.sumAr - K_DESKTOP)).toBeLessThan(1.5 / 2 + 0.001)
    }
  })

  it('non lascia mai una riga vuota', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`p${i}`, 0.66))
    expect(packRows(items, K_DESKTOP).every((r) => r.items.length > 0)).toBe(true)
  })

  it('gestisce fotografie molto panoramiche mettendole da sole', () => {
    const rows = packRows([item('pano', 4), item('a', 1.5), item('b', 1.5)], K_DESKTOP)
    expect(rows[0].items.map((i) => i.id)).toEqual(['pano'])
  })

  it('usa un bersaglio piu piccolo su tablet, producendo piu righe', () => {
    const items = Array.from({ length: 20 }, () => item('x', 1.5))
    expect(packRows(items, K_TABLET).length).toBeGreaterThan(packRows(items, K_DESKTOP).length)
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/gallery/__tests__/packRows.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/gallery/packRows.ts

/**
 * Bersaglio per la somma dei rapporti d aspetto di una riga.
 *
 * Poiche il criterio e espresso in rapporti e non in pixel, la composizione
 * delle righe non dipende dalla larghezza del viewport: si calcola una volta
 * lato server e resta valida a ogni dimensione di schermo. L altezza effettiva
 * di una riga e larghezzaContenitore / sumAr, quindi cresce con lo schermo.
 */
export const K_DESKTOP = 2.8
export const K_TABLET = 1.8

export type Packable = { id: string; ar: number }

export type Row<T extends Packable> = {
  items: T[]
  sumAr: number
  isLast: boolean
}

export function packRows<T extends Packable>(items: readonly T[], target: number): Row<T>[] {
  if (items.length === 0) return []

  const rows: Row<T>[] = []
  let current: T[] = []
  let sum = 0

  for (const item of items) {
    const withItem = sum + item.ar

    // Chiude la riga se aggiungere questo elemento allontana dal bersaglio
    // piu di quanto lo faccia fermarsi qui. Una riga vuota accetta sempre.
    if (current.length > 0 && Math.abs(withItem - target) > Math.abs(sum - target)) {
      rows.push({ items: current, sumAr: sum, isLast: false })
      current = [item]
      sum = item.ar
      continue
    }

    current.push(item)
    sum = withItem
  }

  rows.push({ items: current, sumAr: sum, isLast: true })

  return rows
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run lib/gallery/__tests__/packRows.test.ts
```

Atteso: PASS, 10 test.

- [ ] **Step 5: Commit**

```bash
git add lib/gallery/packRows.ts lib/gallery/__tests__/packRows.test.ts
git commit -m "feat: packer delle righe indipendente dalla larghezza del viewport"
```

---

## Task 4: `sizesForTile`

**Files:**
- Create: `lib/gallery/sizes.ts`
- Test: `lib/gallery/__tests__/sizes.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/gallery/__tests__/sizes.test.ts
import { describe, it, expect } from 'vitest'
import { sizesForTile, CONTENT_MAX_PX, TABLET_MIN_PX } from '../sizes'

describe('sizesForTile', () => {
  it('dichiara larghezza piena sotto il breakpoint tablet', () => {
    expect(sizesForTile(2.8, 1.4)).toContain(`(max-width: ${TABLET_MIN_PX - 1}px) 100vw`)
  })

  it('esprime la frazione di riga occupata dal tile', () => {
    // Un tile che occupa meta della riga: 1.4 su 2.8.
    expect(sizesForTile(2.8, 1.4)).toContain('50vw')
  })

  it('limita la larghezza al contenitore massimo', () => {
    expect(sizesForTile(2.8, 1.4)).toContain(`${Math.round(CONTENT_MAX_PX * 0.5)}px`)
  })

  it('assegna larghezza piena a un tile solo nella sua riga', () => {
    expect(sizesForTile(1.7, 1.7)).toContain('100vw')
  })

  it('arrotonda le percentuali a interi', () => {
    expect(sizesForTile(3, 1)).not.toMatch(/\d+\.\d+vw/)
  })

  it('non produce mai zero', () => {
    expect(sizesForTile(0, 1.5)).toContain('100vw')
  })
})
```

L'ultimo test copre la divisione per zero: una riga con `sumAr` nullo non dovrebbe esistere, ma il valore prodotto non deve essere `NaN` o `0vw`.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/gallery/__tests__/sizes.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/gallery/sizes.ts

/** Deve corrispondere a --content-max in styles/tokens.css. */
export const CONTENT_MAX_PX = 1600

/** Sotto questa larghezza la galleria e a colonna singola. */
export const TABLET_MIN_PX = 768

/**
 * Attributo `sizes` per un tile, ricavato dalla frazione di riga che occupa.
 *
 * Con il packer lato server questa frazione e nota: senza, `sizes` sarebbe per
 * forza un compromesso fra foto sgranate e byte sprecati, perche la larghezza
 * di un tile dipende dai rapporti dei vicini di riga.
 */
export function sizesForTile(rowSumAr: number, tileAr: number): string {
  const fraction = rowSumAr > 0 ? tileAr / rowSumAr : 1
  const vw = Math.max(1, Math.round(fraction * 100))
  const cappedPx = Math.round(CONTENT_MAX_PX * fraction)

  return [
    `(max-width: ${TABLET_MIN_PX - 1}px) 100vw`,
    `(max-width: ${CONTENT_MAX_PX}px) ${vw}vw`,
    `${cappedPx}px`,
  ].join(', ')
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run lib/gallery/__tests__/sizes.test.ts
```

Atteso: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add lib/gallery/sizes.ts lib/gallery/__tests__/sizes.test.ts
git commit -m "feat: attributo sizes calcolato dalla frazione di riga occupata"
```

---

## Task 5: Query della galleria

**Files:**
- Modify: `lib/sanity/queries.ts`
- Test: `lib/sanity/__tests__/queries.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/sanity/__tests__/queries.test.ts
import { describe, it, expect } from 'vitest'
import { galleryPageQuery, galleryCountQuery, homeHeroQuery } from '../queries'

describe('query della galleria', () => {
  it('filtra su showInGallery, cosi le foto escluse restano usabili nei progetti', () => {
    expect(galleryPageQuery).toContain('showInGallery == true')
  })

  it('ordina per orderRank, che e l ordinamento editoriale manuale', () => {
    expect(galleryPageQuery).toContain('orderRank')
  })

  it('pagina con parametri e non con valori interpolati', () => {
    expect(galleryPageQuery).toContain('$start')
    expect(galleryPageQuery).toContain('$end')
  })

  it('chiede il rapporto d aspetto, necessario a riservare lo spazio', () => {
    expect(galleryPageQuery).toContain('aspectRatio')
  })

  it('chiede il LQIP per il placeholder di caricamento', () => {
    expect(galleryPageQuery).toContain('lqip')
  })

  it('conta con lo stesso filtro della pagina, altrimenti hasMore mente', () => {
    expect(galleryCountQuery).toContain('showInGallery == true')
  })

  it('la hero chiede la fotografia protagonista della homepage', () => {
    expect(homeHeroQuery).toContain('heroPhoto')
  })
})
```

Il penultimo test protegge da un difetto sottile: se il conteggio usasse un filtro diverso dalla pagina, `hasMore` sarebbe sbagliato e il pulsante «Carica altre» resterebbe visibile a vuoto o sparirebbe troppo presto.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/sanity/__tests__/queries.test.ts
```

Atteso: FAIL, le query non esistono.

- [ ] **Step 3: Aggiungere le query**

In `lib/sanity/queries.ts`, dopo quelle esistenti:

```ts
const PHOTO_FIELDS = `
  _id,
  altIt, altEn,
  titleIt, titleEn,
  placeIt, placeEn,
  year,
  "url": image.asset->url,
  "aspectRatio": image.asset->metadata.dimensions.aspectRatio,
  "lqip": image.asset->metadata.lqip
`

export const galleryPageQuery = defineQuery(`
  *[_type == "photo" && showInGallery == true && defined(image.asset)]
    | order(orderRank asc)[$start...$end]{${PHOTO_FIELDS}}
`)

export const galleryCountQuery = defineQuery(`
  count(*[_type == "photo" && showInGallery == true && defined(image.asset)])
`)

export const homeHeroQuery = defineQuery(`
  *[_type == "homePage"][0]{
    introIt, introEn,
    "heroPhoto": heroPhoto->{${PHOTO_FIELDS}}
  }
`)
```

`defined(image.asset)` evita che un documento incompleto rompa la pagina, come richiede il design §13.

- [ ] **Step 4: Eseguire e verificare che passi, poi rigenerare i tipi**

```bash
npx vitest run lib/sanity/__tests__/queries.test.ts
npm run sanity:typegen
npm run typecheck
```

Atteso: 7 test passano; typegen riporta un numero di query maggiore di prima; typecheck a zero.

- [ ] **Step 5: Commit**

```bash
git add lib/sanity/queries.ts lib/sanity/__tests__/queries.test.ts
git commit -m "feat: query di galleria e hero con metadati per riservare lo spazio"
```

---

## Task 6: Griglia e tile

**Files:**
- Create: `components/gallery/PhotoGrid.tsx`, `PhotoRow.tsx`, `PhotoTile.tsx`, e i rispettivi `.module.css`
- Test: `components/gallery/__tests__/PhotoGrid.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/gallery/__tests__/PhotoGrid.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoGrid } from '../PhotoGrid'
import { packRows, K_DESKTOP } from '@/lib/gallery/packRows'

const photos = [
  { id: 'a', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg', alt: 'Prima', altLang: 'it' as const, lqip: null },
  { id: 'b', ar: 0.75, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', alt: 'Seconda', altLang: 'it' as const, lqip: null },
  { id: 'c', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/c-3000x2000.jpg', alt: 'Terza', altLang: 'it' as const, lqip: null },
]

const rows = packRows(photos, K_DESKTOP)

describe('PhotoGrid', () => {
  it('rende ogni fotografia', () => {
    render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('rende ogni tile come pulsante nativo, non come div cliccabile', () => {
    render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('apre la lightbox sull indice assoluto, non su quello di riga', async () => {
    const onOpen = vi.fn()
    render(<PhotoGrid rows={rows} locale="it" onOpen={onOpen} />)

    await userEvent.click(screen.getAllByRole('button')[2])
    expect(onOpen).toHaveBeenCalledWith(2)
  })

  it('e attivabile da tastiera', async () => {
    const onOpen = vi.fn()
    render(<PhotoGrid rows={rows} locale="it" onOpen={onOpen} />)

    screen.getAllByRole('button')[0].focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith(0)
  })

  it('imposta il rapporto e il fattore di crescita di ogni tile', () => {
    const { container } = render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    const tile = container.querySelector('button') as HTMLElement

    expect(tile.style.getPropertyValue('--ar')).toBe('1.5')
    expect(tile.style.flexGrow).toBe('1.5')
  })

  it('marca l ultima riga cosi il CSS non la giustifica', () => {
    const { container } = render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    const rowEls = container.querySelectorAll('[data-row]')

    expect(rowEls[rowEls.length - 1].getAttribute('data-last')).toBe('true')
  })
})
```

Il test sull'indice assoluto protegge da un errore facile: la lightbox riceve la sequenza piatta di tutte le fotografie, quindi il tile deve conoscere la propria posizione globale e non quella nella riga.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run components/gallery/__tests__/PhotoGrid.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere `PhotoTile`**

```tsx
// components/gallery/PhotoTile.tsx
'use client'

import type { Locale } from '@/lib/i18n/locales'
import { SanityImage } from '@/components/media/SanityImage'
import { sizesForTile } from '@/lib/gallery/sizes'
import type { GalleryPhoto } from './types'
import styles from './PhotoTile.module.css'

export function PhotoTile({
  photo,
  rowSumAr,
  index,
  locale,
  onOpen,
}: {
  photo: GalleryPhoto
  rowSumAr: number
  index: number
  locale: Locale
  onOpen: (index: number) => void
}) {
  return (
    <button
      type="button"
      className={styles.tile}
      style={{ '--ar': String(photo.ar), flexGrow: photo.ar } as React.CSSProperties}
      onClick={() => onOpen(index)}
    >
      <SanityImage
        photo={{
          url: photo.url,
          aspectRatio: photo.ar,
          lqip: photo.lqip,
          alt: photo.alt,
          altLang: photo.altLang,
        }}
        sizes={sizesForTile(rowSumAr, photo.ar)}
        locale={locale}
      />
    </button>
  )
}
```

```ts
// components/gallery/types.ts
import type { Locale } from '@/lib/i18n/locales'

export type GalleryPhoto = {
  id: string
  ar: number
  url: string
  lqip: string | null
  alt: string
  altLang: Locale
  title?: string
  titleLang?: Locale
  place?: string
  placeLang?: Locale
  year?: number
}
```

- [ ] **Step 4: Scrivere `PhotoRow` e `PhotoGrid`**

```tsx
// components/gallery/PhotoRow.tsx
'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { PhotoTile } from './PhotoTile'
import styles from './PhotoRow.module.css'

export function PhotoRow({
  row,
  startIndex,
  locale,
  onOpen,
}: {
  row: Row<GalleryPhoto>
  startIndex: number
  locale: Locale
  onOpen: (index: number) => void
}) {
  return (
    <div
      className={styles.row}
      data-row
      data-last={row.isLast ? 'true' : undefined}
      style={{ '--sum-ar': String(row.sumAr) } as React.CSSProperties}
    >
      {row.items.map((photo, i) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          rowSumAr={row.sumAr}
          index={startIndex + i}
          locale={locale}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
```

```tsx
// components/gallery/PhotoGrid.tsx
'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { PhotoRow } from './PhotoRow'
import styles from './PhotoGrid.module.css'

export function PhotoGrid({
  rows,
  locale,
  onOpen,
}: {
  rows: Row<GalleryPhoto>[]
  locale: Locale
  onOpen: (index: number) => void
}) {
  let offset = 0

  return (
    <div className={styles.grid}>
      {rows.map((row, i) => {
        const start = offset
        offset += row.items.length
        return (
          <PhotoRow key={i} row={row} startIndex={start} locale={locale} onOpen={onOpen} />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Scrivere il CSS**

```css
/* components/gallery/PhotoGrid.module.css */
.grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--space-4);
}
```

```css
/* components/gallery/PhotoRow.module.css */
.row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

/* L ultima riga non viene giustificata: i tile mantengono l altezza nominale
   e restano allineati a sinistra, invece di stirarsi a tutta larghezza. */
.row[data-last] > * {
  flex-grow: 0 !important;
  width: calc((100% - var(--space-3) * 2) * var(--ar) / 2.8);
}

@media (max-width: 767px) {
  .row {
    flex-direction: column;
  }

  .row > *,
  .row[data-last] > * {
    width: 100%;
    flex-grow: 0 !important;
  }
}
```

```css
/* components/gallery/PhotoTile.module.css */
.tile {
  flex-basis: 0;
  min-width: 0;
  display: block;
  padding: 0;
  border-radius: var(--radius);
  overflow: hidden;
}

.tile:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
```

`flex-basis: 0` con `flex-grow` proporzionale al rapporto dà a ogni tile larghezza `(W − gap) · ar / Σar`, quindi altezza `(W − gap) / Σar`, identica per tutti gli elementi della riga. `min-width: 0` impedisce che la larghezza intrinseca dell'immagine sfondi la riga.

- [ ] **Step 6: Eseguire e verificare che passi**

```bash
npx vitest run components/gallery/__tests__/PhotoGrid.test.tsx
```

Atteso: PASS, 6 test.

- [ ] **Step 7: Commit**

```bash
git add components/gallery
git commit -m "feat: griglia a righe giustificate con tile come pulsanti nativi"
```

---

## Task 7: Server Action `loadMorePhotos`

**Files:**
- Create: `app/actions/loadMorePhotos.ts`, `lib/gallery/toGalleryPhoto.ts`
- Test: `lib/gallery/__tests__/toGalleryPhoto.test.ts`, `app/actions/__tests__/loadMorePhotos.test.ts`

- [ ] **Step 1: Scrivere il test del mapper**

```ts
// lib/gallery/__tests__/toGalleryPhoto.test.ts
import { describe, it, expect } from 'vitest'
import { toGalleryPhoto } from '../toGalleryPhoto'

const raw = {
  _id: 'p1',
  altIt: 'Nebbia',
  altEn: 'Fog',
  titleIt: 'Studio 1',
  titleEn: null,
  placeIt: 'Veneto',
  placeEn: null,
  year: 2024,
  url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
  aspectRatio: 1.5,
  lqip: 'data:image/jpeg;base64,x',
}

describe('toGalleryPhoto', () => {
  it('sceglie l alt nella lingua della pagina', () => {
    expect(toGalleryPhoto(raw, 'en').alt).toBe('Fog')
    expect(toGalleryPhoto(raw, 'it').alt).toBe('Nebbia')
  })

  it('dichiara la lingua dell alt quando ricade sull italiano', () => {
    const photo = toGalleryPhoto({ ...raw, altEn: null }, 'en')
    expect(photo.alt).toBe('Nebbia')
    expect(photo.altLang).toBe('it')
  })

  it('dichiara la lingua del titolo quando ricade sull italiano', () => {
    const photo = toGalleryPhoto(raw, 'en')
    expect(photo.title).toBe('Studio 1')
    expect(photo.titleLang).toBe('it')
  })

  it('omette titolo, luogo e anno quando non sono valorizzati', () => {
    const photo = toGalleryPhoto(
      { ...raw, titleIt: null, titleEn: null, placeIt: null, placeEn: null, year: null },
      'it',
    )
    expect(photo.title).toBeUndefined()
    expect(photo.place).toBeUndefined()
    expect(photo.year).toBeUndefined()
  })

  it('ricade su un rapporto quadrato se il metadato manca', () => {
    expect(toGalleryPhoto({ ...raw, aspectRatio: null }, 'it').ar).toBe(1)
  })
})
```

L'ultimo test evita un `NaN` che manderebbe in pezzi il packer se un asset avesse metadati incompleti.

- [ ] **Step 2: Eseguire, verificare che fallisca, implementare**

```ts
// lib/gallery/toGalleryPhoto.ts
import { pickLocalized } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'

type RawPhoto = {
  _id: string
  altIt?: string | null
  altEn?: string | null
  titleIt?: string | null
  titleEn?: string | null
  placeIt?: string | null
  placeEn?: string | null
  year?: number | null
  url?: string | null
  aspectRatio?: number | null
  lqip?: string | null
}

export function toGalleryPhoto(raw: RawPhoto, locale: Locale): GalleryPhoto {
  const alt = pickLocalized({ it: raw.altIt, en: raw.altEn }, locale)
  const title = pickLocalized({ it: raw.titleIt, en: raw.titleEn }, locale)
  const place = pickLocalized({ it: raw.placeIt, en: raw.placeEn }, locale)

  return {
    id: raw._id,
    ar: raw.aspectRatio && raw.aspectRatio > 0 ? raw.aspectRatio : 1,
    url: raw.url ?? '',
    lqip: raw.lqip ?? null,
    alt: alt.value,
    altLang: alt.lang,
    title: title.value || undefined,
    titleLang: title.value ? title.lang : undefined,
    place: place.value || undefined,
    placeLang: place.value ? place.lang : undefined,
    year: raw.year ?? undefined,
  }
}
```

```bash
npx vitest run lib/gallery/__tests__/toGalleryPhoto.test.ts
```

Atteso: PASS, 5 test.

- [ ] **Step 3: Scrivere il test della Server Action**

```ts
// app/actions/__tests__/loadMorePhotos.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/lib/sanity/fetch', () => ({ sanityFetch: fetchMock }))

const { loadMorePhotos, PAGE_SIZE } = await import('../loadMorePhotos')

function photo(i: number) {
  return {
    _id: `p${i}`,
    altIt: `Foto ${i}`,
    url: `https://cdn.sanity.io/images/p/d/x${i}-3000x2000.jpg`,
    aspectRatio: 1.5,
    lqip: null,
  }
}

describe('loadMorePhotos', () => {
  beforeEach(() => fetchMock.mockReset())

  it('chiede esattamente un gruppo a partire dall offset', async () => {
    fetchMock.mockResolvedValueOnce(0).mockResolvedValueOnce([])
    await loadMorePhotos(24, 'it')

    const call = fetchMock.mock.calls.find((c) => c[0].params?.start !== undefined)
    expect(call?.[0].params).toEqual({ start: 24, end: 24 + PAGE_SIZE })
  })

  it('dichiara hasMore quando restano fotografie oltre il gruppo', async () => {
    fetchMock
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(Array.from({ length: PAGE_SIZE }, (_, i) => photo(i)))

    const result = await loadMorePhotos(0, 'it')
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(100)
  })

  it('dichiara hasMore falso sull ultimo gruppo parziale', async () => {
    fetchMock.mockResolvedValueOnce(30).mockResolvedValueOnce([photo(0), photo(1)])

    const result = await loadMorePhotos(24, 'it')
    expect(result.hasMore).toBe(false)
  })

  it('dichiara hasMore falso quando il gruppo chiude esattamente il totale', async () => {
    fetchMock
      .mockResolvedValueOnce(48)
      .mockResolvedValueOnce(Array.from({ length: PAGE_SIZE }, (_, i) => photo(i)))

    const result = await loadMorePhotos(24, 'it')
    expect(result.hasMore).toBe(false)
  })

  it('restituisce righe gia impaccate, cosi l append non ricalcola nulla', async () => {
    fetchMock.mockResolvedValueOnce(48).mockResolvedValueOnce([photo(0), photo(1), photo(2)])

    const result = await loadMorePhotos(0, 'it')
    expect(Array.isArray(result.rows)).toBe(true)
    expect(result.rows.flatMap((r) => r.items.map((i) => i.id))).toEqual(['p0', 'p1', 'p2'])
  })

  it('restituisce un risultato vuoto oltre il totale', async () => {
    fetchMock.mockResolvedValueOnce(10).mockResolvedValueOnce([])

    const result = await loadMorePhotos(240, 'it')
    expect(result.rows).toEqual([])
    expect(result.hasMore).toBe(false)
  })
})
```

I casi al confine — ultimo gruppo parziale, gruppo che chiude esattamente il totale, offset oltre il totale — sono l'unico punto in cui la paginazione può sbagliare di uno, e il design §15.2 li richiede esplicitamente.

- [ ] **Step 4: Implementare la Server Action**

```ts
// app/actions/loadMorePhotos.ts
'use server'

import { sanityFetch } from '@/lib/sanity/fetch'
import { galleryPageQuery, galleryCountQuery } from '@/lib/sanity/queries'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import { packRows, K_DESKTOP } from '@/lib/gallery/packRows'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from '@/components/gallery/types'
import type { Locale } from '@/lib/i18n/locales'

export const PAGE_SIZE = 24

export type LoadMoreResult = {
  rows: Row<GalleryPhoto>[]
  hasMore: boolean
  total: number
}

export async function loadMorePhotos(offset: number, locale: Locale): Promise<LoadMoreResult> {
  const total = await sanityFetch({ query: galleryCountQuery, tags: ['gallery'] })

  const raw = await sanityFetch({
    query: galleryPageQuery,
    params: { start: offset, end: offset + PAGE_SIZE },
    tags: ['gallery'],
  })

  const photos = (raw ?? []).map((p) => toGalleryPhoto(p, locale))

  return {
    rows: packRows(photos, K_DESKTOP),
    hasMore: offset + photos.length < (total ?? 0),
    total: total ?? 0,
  }
}
```

`hasMore` è calcolato dal totale, non dedotto dal numero di elementi ricevuti: dedurlo darebbe il risultato sbagliato quando l'ultimo gruppo è esattamente pieno.

- [ ] **Step 5: Eseguire e verificare che passi**

```bash
npx vitest run app/actions/__tests__/loadMorePhotos.test.ts
```

Atteso: PASS, 6 test.

- [ ] **Step 6: Commit**

```bash
git add app/actions lib/gallery/toGalleryPhoto.ts lib/gallery/__tests__/toGalleryPhoto.test.ts app/actions/__tests__
git commit -m "feat: Server Action di paginazione che restituisce righe gia impaccate"
```

---

## Task 8: `LoadMoreButton`

**Files:**
- Create: `components/gallery/LoadMoreButton.tsx`, `.module.css`, `components/feedback/StatusRegion.tsx`
- Test: `components/gallery/__tests__/LoadMoreButton.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/gallery/__tests__/LoadMoreButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoadMoreButton } from '../LoadMoreButton'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

describe('LoadMoreButton', () => {
  it('non compare quando non ci sono altre fotografie', () => {
    render(<LoadMoreButton hasMore={false} loading={false} error={false} dict={dict} onLoad={vi.fn()} />)
    expect(screen.queryByRole('button', { name: dict.loadMore })).toBeNull()
  })

  it('chiede il gruppo successivo al clic', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading={false} error={false} dict={dict} onLoad={onLoad} />)

    await userEvent.click(screen.getByRole('button', { name: dict.loadMore }))
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('usa aria-disabled durante il caricamento, per non perdere il focus', () => {
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={vi.fn()} />)
    const button = screen.getByRole('button')

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toHaveAttribute('disabled')
  })

  it('non richiede un secondo gruppo se e gia in caricamento', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={onLoad} />)

    await userEvent.click(screen.getByRole('button'))
    expect(onLoad).not.toHaveBeenCalled()
  })

  it('annuncia il caricamento in una regione di stato, non sulla griglia', () => {
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(dict.loading)
  })

  it('offre un retry inline in caso di errore', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading={false} error dict={dict} onLoad={onLoad} />)

    const retry = screen.getByRole('button', { name: dict.retry })
    await userEvent.click(retry)
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('comunica l errore nella regione di stato', () => {
    render(<LoadMoreButton hasMore loading={false} error dict={dict} onLoad={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(dict.errorGeneric)
  })
})
```

Il terzo test fissa una scelta precisa del design §7.1: `aria-disabled` e non `disabled`, perché disabilitare un pulsante che ha il focus lo fa perdere, lasciando l'utente da tastiera senza punto di riferimento.

Nessun `aria-live` sulla griglia: il default `aria-relevant="additions text"` farebbe leggere gli alt text di tutte e 24 le nuove fotografie di fila.

- [ ] **Step 2: Eseguire, verificare che fallisca, implementare**

```tsx
// components/feedback/StatusRegion.tsx
export function StatusRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {message}
    </div>
  )
}
```

```tsx
// components/gallery/LoadMoreButton.tsx
'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { StatusRegion } from '@/components/feedback/StatusRegion'
import styles from './LoadMoreButton.module.css'

export function LoadMoreButton({
  hasMore,
  loading,
  error,
  dict,
  onLoad,
}: {
  hasMore: boolean
  loading: boolean
  error: boolean
  dict: Dictionary
  onLoad: () => void
}) {
  const message = loading ? dict.loading : error ? dict.errorGeneric : ''

  if (!hasMore) return <StatusRegion message={message} />

  return (
    <div className={styles.wrapper}>
      <StatusRegion message={message} />

      {error ? (
        <button type="button" className={styles.button} onClick={onLoad}>
          {dict.retry}
        </button>
      ) : (
        <button
          type="button"
          className={styles.button}
          aria-disabled={loading || undefined}
          onClick={() => {
            if (!loading) onLoad()
          }}
        >
          {dict.loadMore}
        </button>
      )}
    </div>
  )
}
```

```css
/* components/gallery/LoadMoreButton.module.css */
.wrapper {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}

.button {
  position: relative;
  padding: var(--space-3) var(--space-5);
  min-height: var(--target-min);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg);
  transition: border-color var(--duration-fast) var(--ease);
}

.button:hover { border-color: var(--fg-muted); }

.button[aria-disabled='true'] {
  color: var(--fg-muted);
  cursor: default;
}
```

- [ ] **Step 3: Eseguire e verificare che passi**

```bash
npx vitest run components/gallery/__tests__/LoadMoreButton.test.tsx
```

Atteso: PASS, 7 test.

- [ ] **Step 4: Commit**

```bash
git add components/gallery/LoadMoreButton.tsx components/gallery/LoadMoreButton.module.css components/feedback/StatusRegion.tsx components/gallery/__tests__/LoadMoreButton.test.tsx
git commit -m "feat: Carica altre con regione di stato e aria-disabled"
```

---

## Task 9: Lightbox su `<dialog>`

**Files:**
- Create: `components/lightbox/Lightbox.tsx`, `LightboxCaption.tsx`, `useScrollLock.ts`, e i `.module.css`
- Test: `components/lightbox/__tests__/Lightbox.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/lightbox/__tests__/Lightbox.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox } from '../Lightbox'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const photos = [
  { id: 'a', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg', lqip: null, alt: 'Prima', altLang: 'it' as const, title: 'Nebbia', titleLang: 'it' as const, year: 2024, place: 'Veneto', placeLang: 'it' as const },
  { id: 'b', ar: 0.75, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', lqip: null, alt: 'Seconda', altLang: 'it' as const },
]

beforeAll(() => {
  // jsdom non implementa i metodi di <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function setup(index = 0, onClose = vi.fn(), onNavigate = vi.fn()) {
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
  return { onClose, onNavigate }
}

describe('Lightbox', () => {
  it('ha sempre un nome accessibile, anche senza titolo', () => {
    setup(1)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName()
  })

  it('usa il titolo come nome accessibile quando c e', () => {
    setup(0)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Nebbia/)
  })

  it('mostra titolo, anno e luogo solo quando valorizzati', () => {
    setup(0)
    expect(screen.getByText('Nebbia')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Veneto')).toBeInTheDocument()
  })

  it('non mostra didascalia quando i campi mancano', () => {
    setup(1)
    expect(screen.queryByText('Nebbia')).toBeNull()
    expect(screen.queryByText('2024')).toBeNull()
  })

  it('chiude con Esc', async () => {
    const { onClose } = setup(0)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('naviga con le frecce', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('non supera l ultima fotografia', async () => {
    const { onNavigate } = setup(1)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('non va prima della prima fotografia', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowLeft}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('annuncia la posizione a ogni navigazione', () => {
    setup(0)
    expect(screen.getByRole('status')).toHaveTextContent('1')
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('espone i pulsanti di chiusura e navigazione, alternativa allo swipe', () => {
    setup(0)
    expect(screen.getByRole('button', { name: dict.lightboxClose })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: dict.lightboxNext })).toBeInTheDocument()
  })

  it('applica la superficie scura indipendentemente dal tema del sito', () => {
    setup(0)
    expect(screen.getByRole('dialog').className).toMatch(/surface-dark/)
  })
})
```

Il primo test è il più importante: il titolo è opzionale per specifica §5.1, quindi una dialog anonima sarebbe il caso più frequente, non un caso limite.

L'ultimo verifica che la lightbox applichi `.surface-dark`, senza cui in tema chiaro erediterebbe i colori chiari pur dovendo restare scura.

**Nota su jsdom:** `HTMLDialogElement.showModal` e `close` non sono implementati, quindi il test li sostituisce. Questo significa che l'inertizzazione del resto della pagina — la ragione principale per cui si usa `<dialog>` — **non è verificabile in jsdom**: va verificata negli end-to-end del Task 12.

- [ ] **Step 2: Eseguire, verificare che fallisca, implementare**

```tsx
// components/lightbox/LightboxCaption.tsx
import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'
import styles from './LightboxCaption.module.css'

export function LightboxCaption({ photo, locale }: { photo: GalleryPhoto; locale: Locale }) {
  if (!photo.title && !photo.year && !photo.place) return null

  return (
    <figcaption className={styles.caption}>
      {photo.title ? (
        <span lang={photo.titleLang === locale ? undefined : photo.titleLang}>{photo.title}</span>
      ) : null}
      {photo.place ? (
        <span lang={photo.placeLang === locale ? undefined : photo.placeLang}>{photo.place}</span>
      ) : null}
      {photo.year ? <span>{photo.year}</span> : null}
    </figcaption>
  )
}
```

```tsx
// components/lightbox/Lightbox.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { LightboxCaption } from './LightboxCaption'
import { useScrollLock } from './useScrollLock'
import styles from './Lightbox.module.css'

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
  const photo = photos[index]

  useScrollLock()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, photos.length, onNavigate])

  const position = `${index + 1} / ${photos.length}`
  const label = photo.title ? `${photo.title} — ${position}` : `${dict.lightboxLabel} — ${position}`

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} surface-dark`}
      aria-label={label}
      onClose={onClose}
      onCancel={onClose}
    >
      <div role="status" aria-live="polite" className="visually-hidden">
        {position}
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        autoFocus
      >
        {dict.lightboxClose}
      </button>

      <figure className={styles.figure}>
        <SanityImage
          photo={{ url: photo.url, aspectRatio: photo.ar, lqip: photo.lqip, alt: photo.alt, altLang: photo.altLang }}
          sizes="100vw"
          locale={locale}
          className={styles.image}
        />
        <LightboxCaption photo={photo} locale={locale} />
      </figure>

      <button
        type="button"
        className={styles.prev}
        onClick={() => onNavigate(index - 1)}
        disabled={index === 0}
      >
        {dict.lightboxPrev}
      </button>

      <button
        type="button"
        className={styles.next}
        onClick={() => onNavigate(index + 1)}
        disabled={index === photos.length - 1}
      >
        {dict.lightboxNext}
      </button>
    </dialog>
  )
}
```

```ts
// components/lightbox/useScrollLock.ts
'use client'

import { useEffect } from 'react'

/**
 * Blocco dello scroll di sfondo, iOS incluso.
 *
 * `overflow: hidden` su body NON blocca lo scroll touch su iOS Safari, e
 * showModal() non lo risolve: inertizzare il documento non impedisce lo
 * scorrimento. Serve position: fixed con ripristino esatto della posizione.
 * Il salto da scrollbar e gia coperto da scrollbar-gutter: stable nei token.
 */
export function useScrollLock() {
  useEffect(() => {
    const y = window.scrollY
    const body = document.body
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width }

    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      window.scrollTo(0, y)
    }
  }, [])
}
```

- [ ] **Step 3: Scrivere il CSS**

```css
/* components/lightbox/Lightbox.module.css */
.dialog {
  width: 100vw;
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  padding: 0;
  border: none;
  background: var(--bg);
  color: var(--fg);
  display: grid;
  grid-template-rows: 1fr auto;
  place-items: center;
}

.dialog::backdrop {
  background: #000;
}

.figure {
  display: grid;
  place-items: center;
  gap: var(--space-3);
  max-width: min(100vw, calc(100dvh * 2));
  max-height: 100dvh;
  padding: var(--space-5) var(--space-4);
  /* pan-y preserva lo scroll verticale, pinch-zoom preserva l ingrandimento,
     che e il meccanismo con cui un utente ipovedente ingrandisce la foto. */
  touch-action: pan-y pinch-zoom;
}

.image {
  max-height: 80dvh;
}

.close, .prev, .next {
  position: absolute;
  min-width: var(--target-min);
  min-height: var(--target-min);
  padding: var(--space-2) var(--space-3);
  color: var(--fg);
  border-radius: var(--radius);
}

.close { top: var(--space-3); right: var(--space-3); }
.prev { left: var(--space-3); top: 50%; translate: 0 -50%; }
.next { right: var(--space-3); top: 50%; translate: 0 -50%; }

.close:focus-visible, .prev:focus-visible, .next:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.prev:disabled, .next:disabled { opacity: 0.35; cursor: default; }
```

```css
/* components/lightbox/LightboxCaption.module.css */
.caption {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  color: var(--fg-muted);
  font-size: 0.875rem;
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run components/lightbox/__tests__/Lightbox.test.tsx
```

Atteso: PASS, 11 test.

- [ ] **Step 5: Commit**

```bash
git add components/lightbox
git commit -m "feat: lightbox su dialog nativo con blocco scroll iOS-safe"
```

---

## Task 10: Pagina galleria

**Files:**
- Create: `views/GalleryView.tsx`, `components/gallery/GalleryClient.tsx`, `.module.css`
- Modify: `app/[locale]/[[...segments]]/page.tsx`

- [ ] **Step 1: Scrivere `GalleryClient`**

Possiede lo stato che il Server Component non può avere: fotografie accumulate, indice della lightbox, stato del caricamento.

```tsx
// components/gallery/GalleryClient.tsx
'use client'

import { useState, useTransition } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Row } from '@/lib/gallery/packRows'
import type { GalleryPhoto } from './types'
import { loadMorePhotos } from '@/app/actions/loadMorePhotos'
import { PhotoGrid } from './PhotoGrid'
import { LoadMoreButton } from './LoadMoreButton'
import { Lightbox } from '@/components/lightbox/Lightbox'

export function GalleryClient({
  initialRows,
  initialHasMore,
  locale,
  dict,
}: {
  initialRows: Row<GalleryPhoto>[]
  initialHasMore: boolean
  locale: Locale
  dict: Dictionary
}) {
  const [rows, setRows] = useState(initialRows)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [error, setError] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const photos = rows.flatMap((row) => row.items)

  function load() {
    setError(false)
    startTransition(async () => {
      try {
        const result = await loadMorePhotos(photos.length, locale)
        // Ogni gruppo e un blocco di righe indipendente: le righe gia rese
        // restano congelate e l append non le rigiustifica.
        setRows((current) => [...current, ...result.rows])
        setHasMore(result.hasMore)
      } catch {
        setError(true)
      }
    })
  }

  return (
    <>
      <PhotoGrid rows={rows} locale={locale} onOpen={setOpenIndex} />

      <LoadMoreButton
        hasMore={hasMore}
        loading={pending}
        error={error}
        dict={dict}
        onLoad={load}
      />

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          locale={locale}
          dict={dict}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  )
}
```

- [ ] **Step 2: Scrivere `GalleryView`**

```tsx
// views/GalleryView.tsx
import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { loadMorePhotos } from '@/app/actions/loadMorePhotos'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './GalleryView.module.css'

export async function GalleryView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const first = await loadMorePhotos(0, locale)

  return (
    <div className={styles.gallery}>
      <h1 className={styles.title}>{dict.navGallery}</h1>

      {first.rows.length === 0 ? (
        <EmptyState message={dict.emptyGallery} />
      ) : (
        <GalleryClient
          initialRows={first.rows}
          initialHasMore={first.hasMore}
          locale={locale}
          dict={dict}
        />
      )}
    </div>
  )
}
```

```tsx
// components/feedback/EmptyState.tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ color: 'var(--fg-muted)', padding: 'var(--space-6) var(--space-4)' }}>
      {message}
    </p>
  )
}
```

```css
/* views/GalleryView.module.css */
.gallery {
  padding: var(--space-6) 0;
}

.title {
  max-width: var(--content-max);
  margin: 0 auto var(--space-5);
  padding: 0 var(--space-4);
}
```

- [ ] **Step 3: Collegare la rotta**

In `app/[locale]/[[...segments]]/page.tsx`, aggiungere il caso al `switch`:

```tsx
    case 'gallery':
      return <GalleryView locale={locale} />
```

e l'import corrispondente. Aggiungere anche `gallery` a `generateStaticParams`:

```tsx
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => [
    { locale, segments: [] as string[] },
    { locale, segments: [...ROUTES.gallery[locale]] },
  ])
}
```

- [ ] **Step 4: Riattivare la voce di menu**

In `components/layout/Header.tsx` la voce Fotografie esiste già. Verificare che punti a una pagina esistente e non più a una 404.

- [ ] **Step 5: Verificare a mano**

```bash
npm run dev
```

| URL | Atteso |
|---|---|
| `/it/fotografie` | galleria, status 200 |
| `/en/photographs` | galleria, status 200 |
| `/it/gallery` | ancora 404 |

Verificare che le righe siano giustificate, che le altezze coincidano dentro ciascuna riga, e che l'ultima riga non sia stirata a tutta larghezza.

- [ ] **Step 6: Commit**

```bash
git add views components/gallery components/feedback app
git commit -m "feat: pagina galleria con righe impaccate lato server e lightbox"
```

---

## Task 11: Fotografia protagonista e menu mobile

**Files:**
- Modify: `views/HomeView.tsx`, `components/layout/Header.tsx`
- Create: `components/layout/MobileMenu.tsx`, `.module.css`
- Test: `components/layout/__tests__/MobileMenu.test.tsx`

- [ ] **Step 1: Aggiungere la hero a `HomeView`**

```tsx
// dentro HomeView, dopo la query
const home = await sanityFetch({ query: homeHeroQuery, tags: ['home'] })
const hero = home?.heroPhoto ? toGalleryPhoto(home.heroPhoto, locale) : null
```

e nel markup, prima del titolo:

```tsx
{hero ? (
  <div className={styles.hero}>
    <SanityImage
      photo={{ url: hero.url, aspectRatio: hero.ar, lqip: hero.lqip, alt: hero.alt, altLang: hero.altLang }}
      sizes="100vw"
      locale={locale}
      priority
    />
  </div>
) : null}
```

**Questa è l'unica immagine dell'intero sito con `priority`.** La galleria e la lightbox caricano sempre in lazy. Il vincolo è verificato in code review, non a runtime.

```css
/* in HomeView.module.css */
.hero {
  width: 100%;
  max-height: 88dvh;
  overflow: hidden;
  margin-bottom: var(--space-6);
}
```

- [ ] **Step 2: Scrivere il test del menu mobile**

```tsx
// components/layout/__tests__/MobileMenu.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileMenu } from '../MobileMenu'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

describe('MobileMenu', () => {
  it('parte chiuso e lo dichiara', () => {
    render(<MobileMenu locale="it" dict={dict} />)
    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveAttribute('aria-expanded', 'false')
  })

  it('collega il trigger al pannello che controlla', () => {
    render(<MobileMenu locale="it" dict={dict} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })
    const id = trigger.getAttribute('aria-controls')

    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toBeInTheDocument()
  })

  it('apre e aggiorna aria-expanded', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('button', { name: dict.closeMenu })).toHaveAttribute('aria-expanded', 'true')
  })

  it('chiude con Esc e restituisce il focus al trigger', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveFocus()
  })

  it('espone il collegamento alla galleria quando aperto', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('link', { name: dict.navGallery })).toHaveAttribute('href', '/it/fotografie')
  })
})
```

- [ ] **Step 3: Implementare, eseguire, verificare che passi**

```tsx
// components/layout/MobileMenu.tsx
'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import styles from './MobileMenu.module.css'

export function MobileMenu({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={styles.menu} onKeyDown={(e) => e.key === 'Escape' && open && close()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? dict.closeMenu : dict.openMenu}
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <Link href={pathFor(locale, { key: 'gallery' })} onClick={close}>
          {dict.navGallery}
        </Link>
      </div>
    </div>
  )
}
```

```css
/* components/layout/MobileMenu.module.css */
.menu { position: relative; }

.trigger {
  min-width: var(--target-min);
  min-height: var(--target-min);
  padding: var(--space-2);
  color: var(--fg-muted);
}

.panel {
  position: absolute;
  right: 0;
  top: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 10;
}

@media (min-width: 768px) {
  .menu { display: none; }
}
```

In `Header.module.css` nascondere la `nav` desktop sotto il breakpoint:

```css
@media (max-width: 767px) {
  .nav { display: none; }
}
```

- [ ] **Step 4: Commit**

```bash
git add views components/layout
git commit -m "feat: fotografia protagonista e menu mobile navigabile da tastiera"
```

---

## Task 12: End-to-end di galleria e lightbox

**Files:**
- Create: `e2e/gallery.spec.ts`, `e2e/lightbox.spec.ts`
- Modify: `e2e/a11y.spec.ts`

- [ ] **Step 1: Scrivere gli e2e della galleria**

```ts
// e2e/gallery.spec.ts
import { test, expect } from '@playwright/test'

test('la galleria mostra le fotografie in entrambe le lingue', async ({ page }) => {
  await page.goto('/it/fotografie')
  await expect(page.getByRole('button').first()).toBeVisible()

  await page.goto('/en/photographs')
  await expect(page.getByRole('button').first()).toBeVisible()
})

test('le fotografie di una riga hanno la stessa altezza', async ({ page }) => {
  await page.goto('/it/fotografie')

  const heights = await page.locator('[data-row]').first().locator('button').evaluateAll(
    (tiles) => tiles.map((t) => Math.round(t.getBoundingClientRect().height)),
  )

  expect(new Set(heights).size).toBe(1)
})

test('la pagina non scorre orizzontalmente', async ({ page }) => {
  await page.goto('/it/fotografie')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('l ultima riga non e stirata a tutta larghezza', async ({ page }) => {
  await page.goto('/it/fotografie')

  const rows = page.locator('[data-row]')
  const count = await rows.count()
  const last = rows.nth(count - 1)

  const [rowWidth, tilesWidth] = await Promise.all([
    last.evaluate((el) => el.getBoundingClientRect().width),
    last.locator('button').evaluateAll((tiles) =>
      tiles.reduce((sum, t) => sum + t.getBoundingClientRect().width, 0),
    ),
  ])

  // Se l ultima riga fosse giustificata, i tile riempirebbero tutta la larghezza.
  if ((await last.locator('button').count()) < 2) return
  expect(tilesWidth).toBeLessThanOrEqual(rowWidth)
})

test('Carica altre aggiunge fotografie senza spostare quelle gia visibili', async ({ page }) => {
  await page.goto('/it/fotografie')

  const button = page.getByRole('button', { name: 'Carica altre' })
  if (!(await button.isVisible())) test.skip(true, 'meno di 24 fotografie nel dataset')

  const before = await page.locator('[data-row] button').count()
  const firstTileBox = await page.locator('[data-row] button').first().boundingBox()

  await button.click()
  await expect(page.locator('[data-row] button')).not.toHaveCount(before)

  const afterBox = await page.locator('[data-row] button').first().boundingBox()
  expect(afterBox?.y).toBe(firstTileBox?.y)
})
```

Il penultimo test è la verifica concreta della scelta del design §7.1: ogni gruppo è un blocco di righe indipendente, quindi l'append non rigiustifica l'ultima riga già resa e non sposta nulla.

- [ ] **Step 2: Scrivere gli e2e della lightbox**

```ts
// e2e/lightbox.spec.ts
import { test, expect } from '@playwright/test'

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
  await page.evaluate(() => window.scrollTo(0, 400))
  const before = await page.evaluate(() => window.scrollY)

  await page.locator('[data-row] button').first().click()
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
```

Il test sull'inertizzazione e quello sullo scroll sono i due che giustificano l'intera scelta di `<dialog>` e di `useScrollLock`, e sono verificabili solo qui: jsdom non implementa `showModal`.

- [ ] **Step 3: Estendere lo scan di accessibilità**

In `e2e/a11y.spec.ts` aggiungere la galleria alle pagine scansionate e uno scan con la lightbox aperta:

```ts
const PAGES = ['/it', '/en', '/it/fotografie', '/en/photographs']
```

```ts
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
```

- [ ] **Step 4: Eseguire l'intera suite**

```bash
npm run e2e
```

Le violazioni axe vanno **corrette nel componente che le causa**, non silenziate con esclusioni.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: e2e di galleria, lightbox e accessibilità con dialog aperta"
```

---

## Task 13: Verifiche di checkpoint

Questa task non produce codice: produce prove.

- [ ] **Step 1: Verificare che la galleria resti statica**

```bash
npm run build
```

`/[locale]/[[...segments]]` deve restare prerenderizzata, con `/it/fotografie` e `/en/photographs` fra i percorsi generati. Se compare come dinamica, una Dynamic API è entrata nella catena — il sospetto principale è la Server Action invocata durante il render invece che dal client.

- [ ] **Step 2: Verificare il `srcset` prodotto**

Con `npm run start`, ispezionare l'HTML di `/it/fotografie`:

```bash
curl -s http://localhost:3000/it/fotografie | grep -o 'srcset="[^"]*"' | head -3
```

Verificare che le larghezze appartengano tutte alla scala `[320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560, 3840]`, che ogni URL contenga `fit=max` e `auto=format`, e che non esistano voci duplicate. Voci duplicate significano che `deviceSizes` non corrisponde alla scala.

- [ ] **Step 3: Verificare l'assenza di spostamenti**

Aprire `/it/fotografie` con la rete rallentata negli strumenti di sviluppo e osservare il caricamento: lo spazio deve essere riservato prima che le immagini arrivino, senza salti.

- [ ] **Step 4: Verificare la qualità su fotografie reali**

Questo passo **non è soddisfacibile con i placeholder**. Richiede fotografie vere di paesaggio, street e ritratto, e serve a tarare la qualità di compressione, oggi fissata a 85 in `imageUrl.loader.ts`. Finché non è fatto, i criteri §17.6 e §17.9 della specifica di prodotto non sono dichiarabili soddisfatti.

- [ ] **Step 5: Eseguire tutto**

```bash
npm run typecheck && npm test && npm run e2e
```

Riportare i numeri reali.

---

## Criteri di completamento della Fase 1B

1. `/it/fotografie` e `/en/photographs` mostrano la galleria con status 200; `/it/gallery` resta 404.
2. Le fotografie di una stessa riga hanno altezza identica, senza ritagli.
3. La pagina non scorre orizzontalmente su nessun breakpoint.
4. L'ultima riga non è stirata a tutta larghezza.
5. «Carica altre» aggiunge 24 fotografie senza spostare quelle già visibili.
6. La lightbox si apre da mouse e tastiera, si chiude con pulsante ed Esc, naviga con le frecce, rende inerte il contenuto sottostante e restituisce il focus al tile di origine.
7. La posizione di scorrimento è identica prima dell'apertura e dopo la chiusura, anche su emulazione iPhone.
8. La lightbox resta scura anche con il sito in tema chiaro.
9. Gli scan axe non riportano violazioni su homepage e galleria, in entrambe le lingue e in entrambi i temi, e con la lightbox aperta.
10. Il `srcset` usa solo larghezze della scala, senza duplicati.
11. Una sola immagine per pagina ha `priority`.
12. `npm run build` mostra le rotte come prerenderizzate.
13. `npm run typecheck`, `npm test` e `npm run e2e` passano tutti.

Il punto sulla qualità fotografica su immagini reali resta aperto per dichiarazione, non per dimenticanza.

---

## Self-review

**Copertura del design:** §6 pipeline immagini → Task 1, 2, 13; §7 packer e griglia → Task 3, 4, 6, 10; §7.1 Carica altre → Task 7, 8; §9 lightbox → Task 9, 12; §8.2 homepage → Task 11; §8.1 menu mobile → Task 11; §13 resilienza (immagine non caricabile, stato vuoto) → Task 2, 10; §15.5 axe → Task 12.

**Consistenza dei tipi:** `GalleryPhoto` è definito una volta in `components/gallery/types.ts` e consumato da `PhotoTile`, `PhotoRow`, `PhotoGrid`, `Lightbox`, `LightboxCaption`, `toGalleryPhoto` e la Server Action. `Row<T>` viene da `packRows.ts` ed è usato con `Row<GalleryPhoto>` ovunque. `PhotoImage` di `SanityImage` è un sottoinsieme costruito esplicitamente a ogni sito di chiamata, non `GalleryPhoto` stesso, perché la lightbox e la griglia passano `sizes` diversi.

**Punti dichiaratamente non verificabili in unit test**, e per questo coperti dagli e2e del Task 12: l'inertizzazione prodotta da `showModal()` e il blocco dello scroll, perché jsdom non implementa `HTMLDialogElement`.

**Rimandato alla Fase 2 e non lasciato implicito:** pagine progetto e About, canonical e `hreflang`, sitemap, robots, webhook di revalidation, e l'header che riceve la rotta corrente per far puntare il selettore lingua alla pagina equivalente invece che alla home.
