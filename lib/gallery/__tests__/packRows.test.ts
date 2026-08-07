import { describe, it, expect } from 'vitest'
import { packRows, K_DESKTOP, K_TABLET } from '../packRows'

const item = (id: string, ar: number) => ({ id, ar })

describe('packRows', () => {
  it('restituisce nessuna riga per un elenco vuoto', () => {
    expect(packRows([], K_DESKTOP)).toEqual([])
  })

  it('mette un solo elemento in una sola riga', () => {
    const rows = packRows([item('a', 1.5)], K_DESKTOP)
    expect(rows).toHaveLength(1)
    expect(rows[0].items.map((i) => i.id)).toEqual(['a'])
  })

  it('non perde ne duplica alcun elemento', () => {
    const items = Array.from({ length: 37 }, (_, i) => item(`p${i}`, 1 + (i % 5) * 0.35))
    const rows = packRows(items, K_DESKTOP)
    const flat = rows.flatMap((r) => r.items.map((i) => i.id))

    expect(flat).toEqual(items.map((i) => i.id))
  })

  it('preserva l ordine editoriale', () => {
    const items = [item('a', 1.7), item('b', 0.7), item('c', 1.5), item('d', 1)]
    const flat = packRows(items, K_DESKTOP).flatMap((r) => r.items.map((i) => i.id))

    expect(flat).toEqual(['a', 'b', 'c', 'd'])
  })

  it('espone la somma dei rapporti di ciascuna riga', () => {
    const rows = packRows([item('a', 1.5), item('b', 1.5)], 3)
    expect(rows[0].sumAr).toBeCloseTo(3, 5)
  })

  it('marca l ultima riga, che non va giustificata', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`p${i}`, 1.5))
    const rows = packRows(items, K_DESKTOP)

    expect(rows[rows.length - 1].isLast).toBe(true)
    expect(rows.slice(0, -1).every((r) => r.isLast === false)).toBe(true)
  })

  it('avvicina la somma dei rapporti al bersaglio K', () => {
    const items = Array.from({ length: 40 }, () => item('x', 1.5))
    const rows = packRows(items, K_DESKTOP)
    const complete = rows.filter((r) => !r.isLast)

    for (const row of complete) {
      // Ogni riga completa sta entro mezzo rapporto medio dal bersaglio.
      expect(Math.abs(row.sumAr - K_DESKTOP)).toBeLessThan(1.5 / 2 + 0.001)
    }
  })

  it('non lascia mai una riga vuota', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`p${i}`, 0.66))
    expect(packRows(items, K_DESKTOP).every((r) => r.items.length > 0)).toBe(true)
  })

  it('gestisce fotografie molto panoramiche mettendole da sole', () => {
    const rows = packRows([item('pano', 4), item('a', 1.5), item('b', 1.5)], K_DESKTOP)
    expect(rows[0].items.map((i) => i.id)).toEqual(['pano'])
  })

  it('usa un bersaglio piu piccolo su tablet, producendo piu righe', () => {
    const items = Array.from({ length: 20 }, () => item('x', 1.5))
    expect(packRows(items, K_TABLET).length).toBeGreaterThan(packRows(items, K_DESKTOP).length)
  })
})
