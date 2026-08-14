'use client'

import { buildImageUrl } from './imageUrl'

/**
 * **Tarata il 14 agosto 2026 su fotografie vere**, non scelta per abitudine.
 *
 * Misurata la galleria intera — venti fotografie — alle larghezze che il sito
 * chiede davvero:
 *
 * | qualita | w=640  | w=1080 |
 * |---------|--------|--------|
 * | 75      |  994 KB| 2671 KB|
 * | 80      | 1145 KB| 3035 KB|
 * | 85      | 1357 KB| 3542 KB|
 * | 90      | 1720 KB| 4403 KB|
 *
 * Da 85 a 80 si risparmia mezzo megabyte sulla pagina mobile. Il confronto
 * visivo e stato fatto sul caso peggiore — le ombre ampie della notturna, dove
 * il JPEG produce banding prima che altrove — ritagliate, ingrandite al doppio
 * e con le ombre sollevate di 3,2 volte: gia fra 75 e 85 la differenza e
 * appena percettibile, e a dimensione naturale non si vede.
 *
 * Scartata l'idea di due valori diversi, piu alto nella lightbox: quel
 * confronto mostra che nemmeno a schermo intero la differenza emerge, e un
 * secondo valore andrebbe poi ricordato da chi tocca il codice.
 *
 * Per tornare indietro basta questa costante.
 */
const QUALITA = 80

export default function sanityImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return buildImageUrl(src, width, { quality: quality ?? QUALITA })
}
