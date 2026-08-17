import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { sizesForLightbox, FIGURE_PADDING_INLINE_PX, IMAGE_MAX_DVH } from '../sizes'

// Vitest serve i moduli via http, quindi `import.meta.url` non e un file:
// URL e non si puo risolvere un percorso relativo a partire da li. La radice
// del progetto e invece la directory da cui Vitest gira.
const leggi = (percorso: string) => readFileSync(resolve(process.cwd(), percorso), 'utf8')

const CSS_LIGHTBOX = leggi('components/lightbox/Lightbox.module.css')
const CSS_TOKEN = leggi('styles/tokens.css')

describe('sizesForLightbox', () => {
  it('toglie i margini laterali della figure dalla larghezza del viewport', () => {
    expect(sizesForLightbox(1)).toContain(`100vw - ${FIGURE_PADDING_INLINE_PX}px`)
  })

  it('limita la larghezza all altezza massima moltiplicata per il rapporto', () => {
    expect(sizesForLightbox(1.5)).toContain(`${IMAGE_MAX_DVH * 1.5}dvh`)
  })

  it('chiede meno larghezza per una fotografia verticale che per una orizzontale', () => {
    const dvh = (sizes: string) => Number(sizes.match(/(\d+)dvh/)![1])

    expect(dvh(sizesForLightbox(0.75))).toBeLessThan(dvh(sizesForLightbox(1.5)))
  })

  it('arrotonda le altezze a interi', () => {
    expect(sizesForLightbox(1.4998125234345707)).not.toMatch(/\d+\.\d+dvh/)
  })

  // E la stringa esatta su cui Next apre l avviso "image is not rendered at
  // full viewport width", ed e falsa: la lightbox non usa mai tutta la
  // larghezza. Il test la tiene fuori per qualunque rapporto.
  it('non dichiara mai la larghezza piena del viewport', () => {
    for (const ar of [0.5, 0.75, 1, 1.5, 3]) {
      expect(sizesForLightbox(ar)).not.toBe('100vw')
    }
  })
})

/**
 * Le due costanti non descrivono se stesse: descrivono due regole scritte
 * altrove, in un foglio di stile che nessun test compila. Finche restano
 * separate, allargare la cornice nel CSS e dimenticare il modulo fa chiedere
 * al CDN un file tarato sulla cornice di ieri — la fotografia esce sgranata e
 * nulla si rompe abbastanza da farsene accorgere.
 */
describe('le costanti combaciano con il CSS che dichiarano di ricalcare', () => {
  it('IMAGE_MAX_DVH e l altezza massima della superficie', () => {
    expect(CSS_LIGHTBOX).toContain(`calc(${IMAGE_MAX_DVH}dvh * var(--ar))`)
    expect(CSS_LIGHTBOX).toContain(`max-height: ${IMAGE_MAX_DVH}dvh`)
  })

  it('FIGURE_PADDING_INLINE_PX e il doppio del padding laterale della figure', () => {
    const paddingFigure = CSS_LIGHTBOX.match(/\.figure \{[^}]*?padding: ([^;]+);/s)![1]
    const token = paddingFigure.trim().split(/\s+/).at(-1)!.match(/var\((--space-\d)\)/)![1]
    const rem = Number(CSS_TOKEN.match(new RegExp(`${token}: ([\\d.]+)rem`))![1])

    expect(FIGURE_PADDING_INLINE_PX).toBe(rem * 16 * 2)
  })
})
