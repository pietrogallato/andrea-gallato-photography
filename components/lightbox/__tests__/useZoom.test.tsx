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
 * I due riferimenti che useZoom pretende, nel caso semplice in cui coincidono.
 *
 * Non e il caso reale — a ritagliare e il dialog, che e lo schermo, e la
 * fotografia dentro e piu piccola — ma e quello dove il limite dello
 * spostamento vale `lato * (livello - 1) / 2`, cioe il conto piu facile da
 * leggere. I casi in cui i due riquadri si separano hanno i test loro piu
 * sotto, e sono quelli dove il conto ingenuo sbaglia.
 */
function riquadriCoincidenti(ref = riquadroFinto()) {
  return { fotografiaRef: ref, corniceRef: ref }
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    expect(result.current.livello).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  it('ingrandisce e riduce senza superare i limiti', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.ingrandisci())
    expect(result.current.livello).toBeGreaterThan(1)

    act(() => { for (let i = 0; i < 20; i++) result.current.riduci() })
    expect(result.current.livello).toBe(1)
  })

  it('non supera mai il tetto della fotografia', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    act(() => { for (let i = 0; i < 30; i++) result.current.ingrandisci() })
    expect(result.current.livello).toBeCloseTo(result.current.tetto)
  })

  it('a riposo non si sposta', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.sposta({ x: 100, y: 100 }))
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  it('da ingranditi si sposta, entro i bordi', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.versoLivello(2))
    act(() => result.current.sposta({ x: 9999, y: 0 }))
    expect(result.current.pan.x).toBe(400)
  })

  it('il doppio tocco fa da interruttore', () => {
    const { result } = renderHook(() =>
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
    )
    act(() => result.current.alDoppioTocco({ x: 0, y: 0 }))
    expect(result.current.livello).toBe(2)
    act(() => result.current.alDoppioTocco({ x: 0, y: 0 }))
    expect(result.current.livello).toBe(1)
  })

  it('si azzera cambiando fotografia', () => {
    const riquadro = riquadroFinto()
    const { result, rerender } = renderHook(
      ({ id }) => useZoom({ id, url: GRANDE, ...riquadriCoincidenti(riquadro), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(riquadro), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(riquadro.ref), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(riquadro.ref), sizesDiRiposo: '800px' }),
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
      useZoom({ id: 'a', url: GRANDE, ...riquadriCoincidenti(riquadro.ref), sizesDiRiposo: '800px' }),
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

  /**
   * Il caso da ingranditi, dove i due riquadri si separano: una quadrata
   * dipinta 900x900 dentro una cornice 1440x900, cioe un desktop.
   *
   * A 1,6x la fotografia e larga 1440 esatti: copre la cornice al pixel, e
   * spostarla in orizzontale non potrebbe che portare in scena lo sfondo.
   * In verticale sborda invece di 540, meta per parte.
   *
   * Misurando la sola fotografia — `lato * (livello - 1) / 2` — verrebbero
   * 270px anche in orizzontale: 270px di nero trascinabili, il 19% dello
   * schermo.
   */
  it('da ingranditi ferma lo spostamento dove la fotografia copre la cornice', () => {
    const fotografia = riquadroMutevole(900, 900)
    const cornice = riquadroMutevole(1440, 900)
    const { result } = renderHook(() =>
      useZoom({
        id: 'a',
        url: GRANDE,
        fotografiaRef: fotografia.ref,
        corniceRef: cornice.ref,
        sizesDiRiposo: '900px',
      }),
    )
    act(() => result.current.versoLivello(1.6))
    act(() => result.current.sposta({ x: 9999, y: 9999 }))

    expect(result.current.pan.x).toBe(0)
    expect(result.current.pan.y).toBeCloseTo(270)
  })

  /**
   * L'altra faccia: sotto il punto in cui la fotografia riempie la cornice non
   * c'e nulla da spostare. Su un telefono 412x915 una quadrata si dipinge
   * 412x412 e copre lo schermo solo da 915/412 = 2,22x in su; a 2x il nero
   * sopra e sotto e fermo, e trascinarlo sarebbe il difetto.
   */
  it('non concede spostamento finche la fotografia non riempie la cornice', () => {
    const fotografia = riquadroMutevole(412, 412)
    const cornice = riquadroMutevole(412, 915)
    const { result } = renderHook(() =>
      useZoom({
        id: 'a',
        url: GRANDE,
        fotografiaRef: fotografia.ref,
        corniceRef: cornice.ref,
        sizesDiRiposo: '412px',
      }),
    )
    act(() => result.current.versoLivello(2))
    act(() => result.current.sposta({ x: 9999, y: 9999 }))

    expect(result.current.pan.y).toBe(0)
    expect(result.current.pan.x).toBeCloseTo(206)
  })

  /**
   * Allargando soltanto la finestra in orizzontale la cornice cresce e la
   * fotografia — vincolata dall'altezza — resta identica: il margine di
   * manovra si stringe senza che la fotografia abbia cambiato un pixel.
   * Osservando la sola fotografia, quel margine resterebbe quello di prima e
   * si potrebbe trascinare in scena la differenza.
   */
  it('rientra nei bordi quando a cambiare e solo la cornice', () => {
    const osservatore = osservatorePilotabile()
    const fotografia = riquadroMutevole(900, 900)
    const cornice = riquadroMutevole(1200, 900)
    const { result } = renderHook(() =>
      useZoom({
        id: 'a',
        url: GRANDE,
        fotografiaRef: fotografia.ref,
        corniceRef: cornice.ref,
        sizesDiRiposo: '900px',
      }),
    )
    act(() => result.current.versoLivello(2))
    act(() => result.current.sposta({ x: 9999, y: 0 }))
    // (900 x 2 - 1200) / 2
    expect(result.current.pan.x).toBe(300)

    act(() => {
      cornice.cambia(1600, 900)
      osservatore.scatta()
    })
    // (900 x 2 - 1600) / 2
    expect(result.current.pan.x).toBe(100)
  })
})
