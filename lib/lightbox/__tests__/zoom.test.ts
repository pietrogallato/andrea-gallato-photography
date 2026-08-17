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
  // A riposo i due riquadri coincidono: la cornice ha la forma della
  // fotografia. E il caso in cui il vecchio conto e quello nuovo danno lo
  // stesso risultato.
  const fotografia = { larghezza: 800, altezza: 600 }
  const cornice = fotografia

  it('a riposo non lascia spostare di un pixel', () => {
    expect(limitaSpostamento({ pan: { x: 50, y: 50 }, livello: 1, fotografia, cornice })).toEqual({
      x: 0,
      y: 0,
    })
  })

  it('lascia passare uno spostamento dentro i limiti', () => {
    // A livello 2 la meta che sborda vale 400 in orizzontale e 300 in verticale.
    expect(limitaSpostamento({ pan: { x: 120, y: -80 }, livello: 2, fotografia, cornice })).toEqual({
      x: 120,
      y: -80,
    })
  })

  it('taglia lo spostamento che aprirebbe una fessura', () => {
    expect(limitaSpostamento({ pan: { x: 999, y: -999 }, livello: 2, fotografia, cornice })).toEqual({
      x: 400,
      y: -300,
    })
  })

  it('non si lascia confondere da un riquadro non misurato', () => {
    expect(
      limitaSpostamento({
        pan: { x: 10, y: 10 },
        livello: 3,
        fotografia: { larghezza: 0, altezza: 0 },
        cornice: { larghezza: 0, altezza: 0 },
      }),
    ).toEqual({ x: 0, y: 0 })
  })

  /**
   * Il caso che conta da quando la cornice si espande: una quadrata dipinta
   * 900x900 dentro uno schermo 1440x900. A 1,6x la fotografia e larga
   * esattamente 1440, cioe copre la cornice al pixel: non sborda di nulla, e
   * spostarla in orizzontale non puo che mettere in scena lo sfondo.
   * In verticale sborda invece di 1440 - 900 = 540, meta per parte.
   */
  it('misura il margine di manovra sulla cornice che ritaglia, non sulla fotografia', () => {
    expect(
      limitaSpostamento({
        pan: { x: 999, y: 999 },
        livello: 1.6,
        fotografia: { larghezza: 900, altezza: 900 },
        cornice: { larghezza: 1440, altezza: 900 },
      }),
    ).toEqual({ x: 0, y: 270 })
  })

  /**
   * Sotto il punto in cui la fotografia copre la cornice non c e proprio nulla
   * da spostare: il nero attorno e fermo, e trascinarlo sarebbe il difetto che
   * questo limite esiste per impedire. Una quadrata 412x412 su un telefono
   * 412x915 copre lo schermo solo da 915/412 = 2,22x in su.
   */
  it('non concede spostamento finche la fotografia non riempie la cornice', () => {
    expect(
      limitaSpostamento({
        pan: { x: 300, y: 200 },
        livello: 2,
        fotografia: { larghezza: 412, altezza: 412 },
        cornice: { larghezza: 412, altezza: 915 },
      }),
    ).toEqual({ x: 206, y: 0 })
  })
})

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
