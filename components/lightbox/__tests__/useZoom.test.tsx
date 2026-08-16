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
  return riquadroMutevole(larghezza, altezza).ref
}

/**
 * Lo stesso riquadro finto, ma che puo cambiare misura a meta test: e l'unico
 * modo di raccontare una finestra ridimensionata o un dialog che si apre.
 */
function riquadroMutevole(larghezza: number, altezza: number) {
  const el = document.createElement('div')
  const ora = { larghezza, altezza }
  el.getBoundingClientRect = () =>
    ({ width: ora.larghezza, height: ora.altezza, left: 0, top: 0, right: ora.larghezza, bottom: ora.altezza, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return {
    ref: { current: el },
    cambia(nuovaLarghezza: number, nuovaAltezza: number) {
      ora.larghezza = nuovaLarghezza
      ora.altezza = nuovaAltezza
    },
  }
}

/**
 * Un ResizeObserver pilotabile. Quello vero non esiste in jsdom, e comunque non
 * scatterebbe mai: senza layout nessun riquadro cambia davvero misura. I test
 * devono poter dire «adesso e cambiato» a mano.
 */
function osservatorePilotabile() {
  const richiami = new Set<() => void>()
  class Finto {
    private richiamo: () => void
    constructor(richiamo: () => void) {
      this.richiamo = richiamo
      richiami.add(richiamo)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      richiami.delete(this.richiamo)
    }
  }
  vi.stubGlobal('ResizeObserver', Finto)
  return { scatta: () => richiami.forEach((r) => r()) }
}

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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
    // E il precaricamento serve solo se poi il srcset viene alzato: senza
    // questa riga si potrebbe cancellare il gesto che cambia variante — cioe
    // il motivo per cui l'effetto esiste — e i byte scaricati sarebbero buttati.
    expect(result.current.sizes).toBe('1600px')
  })

  /**
   * Un gradino che la rete non ha consegnato non deve finire lo stesso
   * nell'attributo `sizes`. Se ci finisse, next/image chiederebbe dal srcset
   * proprio la larghezza appena fallita: al secondo errore scatta `onError` e
   * SanityImage sostituisce la fotografia con il riquadro di ripiego. Chi
   * stava guardando uno scatto ingrandito si ritroverebbe una scatola di testo.
   */
  it('non alza il srcset se il gradino non arriva', async () => {
    vi.useFakeTimers()
    class ImmagineRotta {
      set src(_valore: string) {}
      decode() {
        return Promise.reject(new Error('rete'))
      }
    }
    vi.stubGlobal('Image', ImmagineRotta)

    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadroFinto(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(result.current.sizes).toBe('800px')
    // L'indicatore va spento comunque: il fallimento non e un motivo per
    // lasciare la rotella accesa.
    expect(result.current.attesa).toBe(false)
  })

  /**
   * L'indicatore di attesa non deve sopravvivere alla richiesta che lo ha
   * acceso: chi si stanca e torna a schermo intero mentre la rete arranca si
   * ritroverebbe la rotella piantata sopra una fotografia ferma.
   */
  it('spegne l indicatore se si torna a riposo mentre la rete arranca', async () => {
    vi.useFakeTimers()
    class ImmagineSospesa {
      set src(_valore: string) {}
      decode() {
        // Una decodifica che non finisce mai: e la rete lenta del caso reale.
        return new Promise<void>(() => {})
      }
    }
    vi.stubGlobal('Image', ImmagineSospesa)

    const riquadro = riquadroFinto()
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadro, sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(result.current.attesa).toBe(true)

    act(() => result.current.azzera())
    expect(result.current.livello).toBe(1)
    expect(result.current.attesa).toBe(false)
  })

  /**
   * Le due invarianti del modulo — mai oltre il tetto, mai fuori dai bordi —
   * valgono anche dopo che il riquadro ha cambiato misura sotto i piedi.
   */
  it('riporta il livello sotto il tetto quando il riquadro si allarga', () => {
    const osservatore = osservatorePilotabile()
    const riquadro = riquadroMutevole(800, 600)
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadro.ref, sizesDiRiposo: '800px' }),
    )
    // 3840 pixel disponibili su 800 dipinti: si arriva a 4,8.
    act(() => result.current.versoLivello(4.8))
    expect(result.current.livello).toBeCloseTo(4.8)

    act(() => {
      riquadro.cambia(1600, 1200)
      osservatore.scatta()
    })
    expect(result.current.tetto).toBeCloseTo(2.4)
    expect(result.current.livello).toBeCloseTo(2.4)
  })

  it('rientra nei bordi quando il riquadro si stringe', () => {
    const osservatore = osservatorePilotabile()
    const riquadro = riquadroMutevole(800, 600)
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadro.ref, sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    act(() => result.current.sposta({ x: 9999, y: 0 }))
    expect(result.current.pan.x).toBe(400)

    act(() => {
      riquadro.cambia(400, 300)
      osservatore.scatta()
    })
    // Meta riquadro: il massimo scorrimento a livello 2 dimezza con lui.
    expect(result.current.pan.x).toBe(200)
  })

  /**
   * Il caso del dialog: la lightbox misura zero finche `showModal` non la apre,
   * e nessun evento della finestra segue quell'apertura. Senza qualcuno che
   * riguardi il riquadro, il tetto resterebbe per sempre quello di ripiego.
   */
  it('misura il tetto quando il riquadro compare, non solo al montaggio', () => {
    const osservatore = osservatorePilotabile()
    const riquadro = riquadroMutevole(0, 0)
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, riquadroRef: riquadro.ref, sizesDiRiposo: '800px' }),
    )
    expect(result.current.tetto).toBe(2)

    act(() => {
      riquadro.cambia(800, 600)
      osservatore.scatta()
    })
    expect(result.current.tetto).toBeCloseTo(4.8)
    act(() => result.current.versoLivello(3))
    expect(result.current.livello).toBe(3)
  })
})
