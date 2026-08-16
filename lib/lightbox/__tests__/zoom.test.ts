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
