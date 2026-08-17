/** I due lati sommati del padding orizzontale di .figure: 2 x --space-3. */
export const FIGURE_PADDING_INLINE_PX = 32

/**
 * Deve corrispondere all altezza massima della superficie in
 * Lightbox.module.css.
 *
 * 86 e non 88, e la differenza si vede solo sugli schermi bassi. Sotto la
 * fotografia c e altezza che non scala col viewport: il padding sopra
 * (--space-4 = 24px), lo spazio fino alla didascalia (--space-4 = 24px) e la
 * didascalia stessa su una riga (26px). Settantaquattro pixel fissi: piu la
 * fotografia prende, prima quella somma sfonda e la didascalia finisce sotto
 * il bordo, dove il dialog — che ha overflow: hidden — la taglia.
 *
 * **Misurato il 2026-08-17**, spazzando le altezze di viewport a 1280 di
 * larghezza e cercando la prima che non taglia piu la didascalia:
 *
 *     78dvh + padding 64/40   didascalia intera da 516px in su   (com era)
 *     86dvh + padding 24/24   didascalia intera da 524px in su
 *     88dvh + padding 24/24   didascalia intera da 612px in su
 *
 * Con 88 le altezze fra 516 e 608 avrebbero cominciato a tagliare una
 * didascalia che oggi si legge. 86 e il valore piu alto che non peggiora
 * nessuno schermo, e sui quattro misurati in produzione (1440x900, 1280x720,
 * 412x915, 390x664) la resa e indistinguibile da 88.
 */
export const IMAGE_MAX_DVH = 86

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
 *     .figure     { padding: var(--space-4) var(--space-3) }
 *     .superficie { width: min(100%, calc(86dvh * var(--ar))) }
 *
 * Sono le regole dello stato a RIPOSO, ed e giusto: da ingranditi la cornice
 * diventa lo schermo e la larghezza da chiedere non la decide piu questo
 * calcolo ma `sizesPerLivello`, che parte dai pixel dipinti in quel momento.
 *
 * Resta fuori solo la max-width della figure, che vale su viewport piu larghi
 * che alti il doppio: ignorarla puo far chiedere qualche pixel di troppo, mai
 * di meno, e la fotografia non esce sgranata.
 */
export function sizesForLightbox(ar: number): string {
  const cappedDvh = Math.round(IMAGE_MAX_DVH * ar)

  return `min(100vw - ${FIGURE_PADDING_INLINE_PX}px, ${cappedDvh}dvh)`
}
