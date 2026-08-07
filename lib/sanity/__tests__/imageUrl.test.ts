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
