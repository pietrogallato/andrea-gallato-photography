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

function monta({ indice = 5, quante = 24 }: { indice?: number; quante?: number } = {}) {
  const el = document.createElement('div')
  riquadroFinto(el)
  document.body.appendChild(el)
  const ref = { current: el }
  const vai = vi.fn()
  const { result } = renderHook(() => {
    const zoom = useZoom({ id: 'a', url: GRANDE, fotografiaRef: ref, corniceRef: ref, sizesDiRiposo: '800px' })
    const gesti = useGestiZoom({ superficieRef: ref, zoom, navigazione: { indice, quante, vai } })
    return { zoom, gesti }
  })
  return { el, result, vai }
}

/** Un quinto degli 800px del riquadro finto: la soglia dello swipe vale 160px. */
const OLTRE_SOGLIA = 200
const SOTTO_SOGLIA = 100
/** Abbastanza lento da non passare per scatto: 100px in 2s sono 0,05px/ms. */
const LENTO = 2000

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

/**
 * Il trascinamento che cambia fotografia. I conti stanno in lib/lightbox/swipe.ts
 * e hanno i loro test; qui si guarda l'unica cosa che li non si vede — il
 * collegamento a dita vere: chi decide quando, chi legge la larghezza, e
 * soprattutto che a riposo e da ingranditi lo stesso gesto voglia dire due cose
 * diverse.
 */
describe('useGestiZoom, lo swipe che cambia fotografia', () => {
  it('a riposo un trascinamento oltre soglia porta alla fotografia successiva', () => {
    const { el, result, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1000 + LENTO }))
    })

    expect(vai).toHaveBeenCalledWith(6)
    expect(result.current.gesti.scarto).toBe(0)
  })

  it('a riposo, verso destra, si torna alla precedente', () => {
    const { el, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 + OLTRE_SOGLIA, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 + OLTRE_SOGLIA, y: 300, tempo: 1000 + LENTO }))
    })

    expect(vai).toHaveBeenCalledWith(4)
  })

  /**
   * Mentre il dito trascina, la fotografia deve stargli sotto. Senza questo lo
   * swipe sarebbe un interruttore nascosto: si trascina, non succede niente, e
   * la fotografia cambia solo al rilascio.
   */
  it('la fotografia segue il dito durante il trascinamento', () => {
    const { el, result } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 280, y: 300, tempo: 1100 }))
    })

    expect(result.current.gesti.scarto).toBe(-120)
  })

  it('sotto la soglia non cambia fotografia e lo scarto torna a zero', () => {
    const { el, result, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - SOTTO_SOGLIA, y: 300, tempo: 1100 }))
    })
    expect(result.current.gesti.scarto).toBe(-SOTTO_SOGLIA)

    act(() => {
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - SOTTO_SOGLIA, y: 300, tempo: 1000 + LENTO }))
    })

    expect(vai).not.toHaveBeenCalled()
    // Il ritorno elastico: la fotografia va rimessa al suo posto, o resterebbe
    // di traverso per sempre.
    expect(result.current.gesti.scarto).toBe(0)
  })

  /**
   * Il cuore del criterio, ed e lo stesso che le frecce della tastiera
   * applicano gia: a riposo il trascinamento sfoglia, da ingranditi sposta la
   * vista dentro la fotografia. Sbagliando qui, chi ha ingrandito un dettaglio
   * si ritroverebbe sulla fotografia dopo al primo tentativo di guardarlo.
   */
  it('da ingranditi lo stesso trascinamento sposta la vista e non naviga', () => {
    const { el, result, vai } = monta()
    act(() => result.current.zoom.versoLivello(3))

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1000 + LENTO }))
    })

    expect(vai).not.toHaveBeenCalled()
    expect(result.current.zoom.pan.x).toBeLessThan(0)
    // E la fotografia non deve nemmeno essere scivolata di lato: quello scarto
    // e l'altro gesto.
    expect(result.current.gesti.scarto).toBe(0)
  })

  /**
   * La superficie ha `touch-action: none`, quindi nessun gesto viene piu
   * interpretato dal browser: senza l'asse, un dito che scende per scorrere la
   * pagina porterebbe via la fotografia di lato.
   */
  it('un trascinamento verticale non muove nulla e non naviga', () => {
    const { el, result, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 380, y: 100, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 380, y: 100, tempo: 1150 }))
    })

    expect(vai).not.toHaveBeenCalled()
    expect(result.current.gesti.scarto).toBe(0)
  })

  /**
   * L'asse si fissa una volta sola. Un gesto partito in orizzontale che poi
   * scende non e un gesto verticale: e la mano che ruota attorno al polso
   * mentre trascina, e la fotografia non deve fermarsi a meta strada.
   */
  it('l asse fissato non si rimette in discussione', () => {
    const { el, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 370, y: 305, tempo: 1050 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - OLTRE_SOGLIA, y: 560, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - OLTRE_SOGLIA, y: 560, tempo: 1000 + LENTO }))
    })

    expect(vai).toHaveBeenCalledWith(6)
  })

  /**
   * Un secondo dito che scende e una pizzicata, non uno sfogliare. Senza
   * annullare, chi pizzica per ingrandire partendo con un dito solo si
   * ritroverebbe sulla fotografia successiva.
   */
  it('un secondo dito annulla lo swipe in corso', () => {
    const { el, result, vai } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 340, y: 300, tempo: 1050 }))
    })
    expect(result.current.gesti.scarto).toBe(-60)

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 600, y: 300, tempo: 1100 }))
    })
    expect(result.current.gesti.scarto).toBe(0)

    act(() => {
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 600, y: 300, tempo: 1200 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1300 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1400 }))
    })

    expect(vai).not.toHaveBeenCalled()
  })

  /**
   * Sull'ultima fotografia non c'e un dopo. La decisione sta in swipe.ts, ma
   * che indice e quante arrivino freschi si vede solo da qui.
   */
  it('al bordo dell archivio non naviga, e la fotografia cede senza staccarsi dal dito', () => {
    const { el, result, vai } = monta({ indice: 23, quante: 24 })

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1100 }))
    })
    // Segue il dito, ma resta indietro: e il modo con cui il bordo si fa
    // sentire senza spegnere nulla.
    const seguito = result.current.gesti.scarto
    expect(seguito).toBeLessThan(0)
    expect(Math.abs(seguito)).toBeLessThan(OLTRE_SOGLIA)

    act(() => {
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 400 - OLTRE_SOGLIA, y: 300, tempo: 1000 + LENTO }))
    })
    expect(vai).not.toHaveBeenCalled()
    expect(result.current.gesti.scarto).toBe(0)
  })

  /**
   * Due swipe di fila finiscono nello stesso punto e a pochi millisecondi
   * l'uno dall'altro: per chi guarda solo i rilasci e un doppio tocco
   * perfetto, e chi sfoglia si ritroverebbe la fotografia ingrandita in mano.
   */
  it('due swipe di fila non valgono un doppio tocco', () => {
    const { el, result } = monta()

    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 1, x: 400, y: 300, tempo: 1000 }))
      el.dispatchEvent(puntatore('pointermove', { id: 1, x: 200, y: 300, tempo: 1100 }))
      el.dispatchEvent(puntatore('pointerup', { id: 1, x: 200, y: 300, tempo: 1150 }))
    })
    act(() => {
      el.dispatchEvent(puntatore('pointerdown', { id: 2, x: 400, y: 300, tempo: 1200 }))
      el.dispatchEvent(puntatore('pointermove', { id: 2, x: 200, y: 300, tempo: 1300 }))
      el.dispatchEvent(puntatore('pointerup', { id: 2, x: 200, y: 300, tempo: 1350 }))
    })

    expect(result.current.zoom.livello).toBe(1)
  })
})
