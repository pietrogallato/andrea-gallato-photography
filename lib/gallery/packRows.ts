/**
 * Bersaglio per la somma dei rapporti d aspetto di una riga.
 *
 * Poiche il criterio e espresso in rapporti e non in pixel, la composizione
 * delle righe non dipende dalla larghezza del viewport: si calcola una volta
 * lato server e resta valida a ogni dimensione di schermo. L altezza effettiva
 * di una riga e larghezzaContenitore / sumAr, quindi cresce con lo schermo.
 */
export const K_DESKTOP = 2.8
export const K_TABLET = 1.8

export type Packable = { id: string; ar: number }

export type Row<T extends Packable> = {
  items: T[]
  sumAr: number
  isLast: boolean
}

export function packRows<T extends Packable>(items: readonly T[], target: number): Row<T>[] {
  if (items.length === 0) return []

  const rows: Row<T>[] = []
  let current: T[] = []
  let sum = 0

  for (const item of items) {
    const withItem = sum + item.ar

    // Chiude la riga se aggiungere questo elemento allontana dal bersaglio
    // piu di quanto lo faccia fermarsi qui. Una riga vuota accetta sempre.
    if (current.length > 0 && Math.abs(withItem - target) > Math.abs(sum - target)) {
      rows.push({ items: current, sumAr: sum, isLast: false })
      current = [item]
      sum = item.ar
      continue
    }

    current.push(item)
    sum = withItem
  }

  rows.push({ items: current, sumAr: sum, isLast: true })

  return rows
}
