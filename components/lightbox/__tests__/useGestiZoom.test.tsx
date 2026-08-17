import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useZoom } from '../useZoom'
import { useGestiZoom } from '../useGestiZoom'

const GRANDE = 'https://cdn.sanity.io/images/p/d/abc-4000x2667.jpg'

/**
 * Il piano dichiarava questo hook non verificabile in jsdom. Non e vero, e
 * costa due righe scoprirlo: mancano soltanto la cattura del puntatore e il
 * layout, e sono entrambi surrogabili. Quel che resta — chi conta le dita, chi
 * compone i fattori, chi decide che un gesto e finito — e logica pura, ed e
 * proprio dove si erano annidati i difetti che questi test fissano.
 */
function riquadroFinto(el: HTMLElement, larghezza = 800, altezza = 600) {
  el.getBoundingClientRect = () =>
    ({ width: larghezza, height: altezza, left: 0, top: 0, right: larghezza, bottom: altezza, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

function monta() {
  const el = document.createElement('div')
  riquadroFinto(el)
  document.body.appendChild(el)
  const ref = { current: el }
  const { result } = renderHook(() => {
    const zoom = useZoom({ id: 'a', url: GRANDE, fotografiaRef: ref, superficieRef: ref, sizesDiRiposo: '800px' })
    const gesti = useGestiZoom({ superficieRef: ref, zoom })
    return { zoom, gesti }
  })
  return { el, result }
}

/**
 * jsdom 30 non costruisce PointerEvent con clientX/pointerId, e `timeStamp` e
 * di sola lettura: senza poterlo dettare, il riconoscimento del doppio tocco
 * non sarebbe interrogabile. Un Event nudo con le proprieta che i gestori
 * leggono davvero racconta la stessa storia.
 */
function puntatore(
  tipo: string,
  { id, x, y, tempo = 0 }: { id: number; x: number; y: number; tempo?: number },
) {
  const ev = new Event(tipo, { bubbles: true, cancelable: true })
  Object.assign(ev, { pointerId: id, clientX: x, clientY: y })
  Object.defineProperty(ev, 'timeStamp', { value: tempo })
  return ev
}

function pizzicataDaTrackpad({ deltaY, x = 400, y = 300 }: { deltaY: number; x?: number; y?: number }) {
  return new WheelEvent('wheel', { deltaY, ctrlKey: true, clientX: x, clientY: y, cancelable: true, bubbles: true })
}

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1)
  // La cattura del puntatore non esiste in jsdom, e i gestori la chiamano a
  // ogni dito che tocca.
  Element.prototype.setPointerCapture = function () {}
  Element.prototype.releasePointerCapture = function () {}
  // Il precarico del gradino: qui non e in esame, ma senza un'immagine finta
  // esploderebbe dentro un effetto e sporcherebbe ogni test di questo file.
  class ImmagineFinta {
    set src(_valore: string) {}
    decode() {
      return Promise.resolve()
    }
  }
  vi.stubGlobal('Image', ImmagineFinta)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useGestiZoom', () => {
  /**
   * Il caso vero: si pizzica per tornare a schermo intero, ci si riesce, e
   * nell'istante in cui si alzano le dita la fotografia ribalza da sola. Le due
   * dita finiscono vicine e si alzano a pochi millisecondi l'una dall'altra:
   * per chi guarda solo l'ultimo dito, e un doppio tocco perfetto.
   */
  it('non scambia la fine di una pizzicata per un doppio tocco', () => {
    const { el, result } = monta()
    act(() => result.current.zoom.versoLivello(3))
    expect(result.current.zoom.livello).toBe(3)

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 300, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 520, y: 300, tempo: 1010 }))
    })
    // Le dita si avvicinano: 220px di distanza diventano 20, e il livello
    // scende sotto 1, cioe si ferma a schermo intero.
    act(() => {
      el.dispatchEvent(puntatore('pointermove', { id: 2, x: 320, y: 300, tempo: 1100 }))
    })
    expect(result.current.zoom.livello).toBe(1)

    act(() => {
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 300, y: 300, tempo: 1200 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 320, y: 300, tempo: 1220 }))
    })
    expect(result.current.zoom.livello).toBe(1)
  })

  /**
   * Un terzo dito che si appoggia per sbaglio — il mignolo, il pollice della
   * mano che regge — e poi uno dei due originali che si alza. Si torna a due
   * dita, ma non sono la coppia di prima: se la distanza di partenza resta
   * quella vecchia, il primo micromovimento la confronta con una base che non
   * c entra piu e il livello crolla. Chi stava guardando un dettaglio a 2x si
   * vede tornare la fotografia a schermo intero senza aver chiesto nulla.
   */
  it('il cambio di coppia di dita non fa crollare l ingrandimento', () => {
    const { el, result } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 300, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 500, y: 300, tempo: 1010 }))
    })
    // 200px di distanza diventano 400: livello 2.
    act(() => {
      el.dispatchEvent(puntatore('pointermove', { id: 2, x: 700, y: 300, tempo: 1100 }))
    })
    expect(result.current.zoom.livello).toBeCloseTo(2, 4)

    // Il terzo dito si appoggia, poi si alza uno dei due della coppia iniziale.
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 3, x: 400, y: 300, tempo: 1200 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 700, y: 300, tempo: 1300 }))
    })

    // Un movimento di un pixel della nuova coppia, distante 100px: il livello
    // deve restare quello, non ripartire da un rapporto con i vecchi 200px.
    act(() => {
      el.dispatchEvent(puntatore('pointermove', { id: 3, x: 401, y: 300, tempo: 1400 }))
    })
    expect(result.current.zoom.livello).toBeCloseTo(2, 1)
  })

  it('il doppio tocco con un dito solo continua a ingrandire', () => {
    const { el, result } = monta()
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400, y: 300, tempo: 1010 }))
    })
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 400, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 400, y: 300, tempo: 1110 }))
    })
    expect(result.current.zoom.livello).toBe(2)
  })

  /**
   * Il gesto piu frequente dentro una fotografia ingrandita e il trascinamento,
   * e si fa a piccoli colpi: si sposta un po', si alza il dito, si riparte. Se
   * ogni rilascio conta come tocco, due aggiustamenti ravvicinati diventano un
   * doppio tocco e l'ingrandimento appena scelto viene buttato via mentre si
   * stava solo cercando l'inquadratura.
   */
  it('due micro trascinamenti ravvicinati non valgono un doppio tocco', () => {
    const { el, result } = monta()
    act(() => result.current.zoom.versoLivello(3))

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 420, y: 300, tempo: 1040 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 420, y: 300, tempo: 1060 }))
    })
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 420, y: 300, tempo: 1120 }))
      el.dispatchEvent(puntatore('pointermove', { id: 2, x: 435, y: 300, tempo: 1140 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 435, y: 300, tempo: 1150 }))
    })

    expect(result.current.zoom.livello).toBe(3)
  })

  /**
   * L'altro verso dello stesso difetto: un trascinamento lungo non puo fare da
   * primo tempo di un doppio tocco. Chi finisce di spostare la vista e poi
   * appoggia il dito per fermarsi si vedrebbe tornare a schermo intero.
   */
  it('un trascinamento lungo non fa da primo tempo di un doppio tocco', () => {
    const { el, result } = monta()
    act(() => result.current.zoom.versoLivello(3))

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 100, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 600, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 600, y: 300, tempo: 1120 }))
    })
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 600, y: 300, tempo: 1170 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 600, y: 300, tempo: 1180 }))
    })

    expect(result.current.zoom.livello).toBe(3)
  })

  /**
   * La pizzicata da trackpad e la strada principale su desktop, e arriva come
   * una raffica di eventi wheel. Se ogni evento leggesse il livello dal render
   * precedente, i colpi consegnati prima che React abbia ridipinto
   * partirebbero tutti dallo stesso valore e si sovrascriverebbero a vicenda:
   * si girerebbe la rotella e la fotografia crescerebbe di meno.
   */
  it('compone i colpi di rotella ravvicinati invece di inghiottirli', () => {
    const { el, result } = monta()
    const fattore = Math.exp(0.4) // deltaY -100 su 250 di sensibilita.

    act(() => {
      el.dispatchEvent(pizzicataDaTrackpad({ deltaY: -100 }))
    })
    expect(result.current.zoom.livello).toBeCloseTo(fattore, 4)

    // Due colpi nello stesso giro di eventi, cioe prima che React abbia
    // ridipinto: e la condizione normale di una raffica.
    act(() => {
      el.dispatchEvent(pizzicataDaTrackpad({ deltaY: -100 }))
      el.dispatchEvent(pizzicataDaTrackpad({ deltaY: -100 }))
    })
    expect(result.current.zoom.livello).toBeCloseTo(fattore ** 3, 4)
  })

  /**
   * `data-gesto` toglie la transizione mentre il gesto e in corso. La rotella
   * non produce alcun evento di puntatore: senza marcare anche lei, ogni colpo
   * fa ripartire una transizione di 200ms interrompendo la precedente, e
   * l'immagine insegue le dita con un ritardo permanente — esattamente il
   * difetto che la regola esiste per togliere.
   */
  it('marca il gesto anche durante una raffica di rotella', () => {
    vi.useFakeTimers()
    const { el, result } = monta()

    act(() => {
      el.dispatchEvent(pizzicataDaTrackpad({ deltaY: -100 }))
    })
    expect(result.current.gesti.inGesto).toBe(true)

    // Passata la raffica la transizione deve tornare: e quella che rende
    // morbido il salto dei pulsanti e della tastiera.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.gesti.inGesto).toBe(false)
  })
})
