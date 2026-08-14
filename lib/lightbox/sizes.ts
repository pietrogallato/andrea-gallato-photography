/** I due lati sommati del padding orizzontale di .figure: 2 x --space-5. */
export const FIGURE_PADDING_INLINE_PX = 80

/** Deve corrispondere all altezza massima di .image in Lightbox.module.css. */
export const IMAGE_MAX_DVH = 78

/**
 * Attributo `sizes` per la fotografia della lightbox.
 *
 * La lightbox non mostra la fotografia a tutta larghezza: la fa stare dentro
 * il viewport conservandone il rapporto, quindi una quadrata o una verticale
 * si ferma ben prima dei bordi. Dichiarare `100vw` faceva chiedere al CDN un
 * file largo il doppio di quello dipinto — su uno scatto quadrato a 1280x720,
 * 1280px invece dei 562 serviti.
 *
 * L espressione ricalca le due regole che decidono quella larghezza in
 * Lightbox.module.css:
 *
 *     .figure { padding: … var(--space-5) … }
 *     .image  { width: min(100%, calc(78dvh * var(--ar))) }
 *
 * Resta fuori solo la max-width della figure, che vale su viewport piu larghi
 * che alti il doppio: ignorarla puo far chiedere qualche pixel di troppo, mai
 * di meno, e la fotografia non esce sgranata.
 */
export function sizesForLightbox(ar: number): string {
  const cappedDvh = Math.round(IMAGE_MAX_DVH * ar)

  return `min(100vw - ${FIGURE_PADDING_INLINE_PX}px, ${cappedDvh}dvh)`
}
