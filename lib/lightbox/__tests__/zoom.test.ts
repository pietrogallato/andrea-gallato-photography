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
