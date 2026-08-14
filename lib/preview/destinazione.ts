import { isLocale, type Locale } from '@/lib/i18n/locales'
import { pathFor, ROUTES, type StaticRouteKey } from '@/lib/i18n/routes'

/**
 * Dove mandare chi apre un link di anteprima.
 *
 * **Il percorso non viene mai preso dalla richiesta.** Si legge quale pagina
 * si vuole e lo si **ricostruisce** da `ROUTES`. Reindirizzare a un valore
 * arrivato nella query string sarebbe un open redirect: chiunque intercetti
 * o inoltri un link di anteprima potrebbe costruire un URL sul dominio del
 * sito che porta altrove, e il dominio del sito e proprio cio che lo fa
 * sembrare affidabile.
 *
 * Per lo stesso motivo lo slug e vagliato invece che ripulito: una lista di
 * caratteri ammessi e verificabile, una di caratteri vietati non lo e mai.
 */

/** Solo minuscole, cifre e trattini: la forma che genera lo Studio. */
const SLUG_AMMESSO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const CHIAVI_STATICHE = Object.keys(ROUTES) as StaticRouteKey[]

export type RichiestaAnteprima = {
  locale?: string | null
  tipo?: string | null
  slug?: string | null
}

/** Il segmento sotto cui vive l'anteprima, dinamico e non indicizzato. */
export const SEGMENTO_ANTEPRIMA = 'preview'

/**
 * Lo stesso percorso, dentro il segmento di anteprima.
 *
 * `/it/fotografie` diventa `/it/preview/fotografie`: le pagine pubbliche
 * restano statiche e non sanno nulla delle bozze, l'anteprima vive accanto.
 */
export function inAnteprima(percorso: string): string {
  const [, lingua, ...resto] = percorso.split('/')
  return ['', lingua, SEGMENTO_ANTEPRIMA, ...resto].join('/')
}

export function risolviDestinazione({ locale, tipo, slug }: RichiestaAnteprima): string {
  // L'italiano e la lingua principale del sito: e il ripiego, non un errore.
  const lingua: Locale = isLocale(locale ?? '') ? (locale as Locale) : 'it'

  if (tipo === 'project') {
    // Senza uno slug valido si va all'indice dei progetti: una pagina utile,
    // invece di un 404 o di un percorso costruito su un valore non fidato.
    if (!slug || !SLUG_AMMESSO.test(slug) || slug.length > 96) {
      return pathFor(lingua, { key: 'projects' })
    }
    return pathFor(lingua, { key: 'project', slug })
  }

  const chiave = CHIAVI_STATICHE.find((k) => k === tipo)
  return pathFor(lingua, { key: chiave ?? 'home' })
}
