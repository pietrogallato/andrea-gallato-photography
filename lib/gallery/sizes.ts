/** Deve corrispondere a --content-max in styles/tokens.css. */
export const CONTENT_MAX_PX = 1600

/** Sotto questa larghezza la galleria e a colonna singola. */
export const TABLET_MIN_PX = 768

/**
 * Attributo `sizes` per un tile, ricavato dalla frazione di riga che occupa.
 *
 * Con il packer lato server questa frazione e nota: senza, `sizes` sarebbe per
 * forza un compromesso fra foto sgranate e byte sprecati, perche la larghezza
 * di un tile dipende dai rapporti dei vicini di riga.
 */
export function sizesForTile(rowSumAr: number, tileAr: number): string {
  const fraction = rowSumAr > 0 ? tileAr / rowSumAr : 1
  const vw = Math.max(1, Math.round(fraction * 100))
  const cappedPx = Math.round(CONTENT_MAX_PX * fraction)

  return [
    `(max-width: ${TABLET_MIN_PX - 1}px) 100vw`,
    `(max-width: ${CONTENT_MAX_PX}px) ${vw}vw`,
    `${cappedPx}px`,
  ].join(', ')
}
