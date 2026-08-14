import { describe, it, expect } from 'vitest'
import { sizesForLightbox, FIGURE_PADDING_INLINE_PX, IMAGE_MAX_DVH } from '../sizes'

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
