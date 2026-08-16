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
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ width: larghezza, height: altezza, left: 0, top: 0, right: larghezza, bottom: altezza, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return { current: el }
}

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1)
})

afterEach(() => {
  vi.useRealTimers()
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
  })
})
