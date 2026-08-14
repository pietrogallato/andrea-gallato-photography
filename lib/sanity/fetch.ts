import type { QueryParams } from '@sanity/client'
import { previewClient, publicClient } from './client'

/**
 * Il punto di accesso unico ai dati.
 *
 * **Non chiama mai `draftMode()`.** `draftMode` e una Dynamic API: invocata
 * qui renderebbe dinamica ogni pagina del sito per tutti i visitatori,
 * annullando l'intera strategia di cache. Chi vuole le bozze lo dichiara
 * passando `preview`, e a leggere `draftMode()` e il segmento di anteprima,
 * che e dinamico per conto suo.
 */
export async function sanityFetch<const Q extends string>({
  query,
  params = {},
  tags = [],
  preview = false,
}: {
  query: Q
  params?: QueryParams
  tags?: string[]
  /** Legge anche le bozze. Solo dal segmento di anteprima. */
  preview?: boolean
}) {
  if (preview) {
    // Le bozze non si mettono in cache: cambiano a ogni salvataggio, e una
    // risposta riusata mostrerebbe all'editor una versione che non e piu la
    // sua. Niente tag, per la stessa ragione: non c'e nulla da invalidare.
    return previewClient.fetch(query, params, { cache: 'no-store' })
  }

  return publicClient.fetch(query, params, {
    cache: 'force-cache',
    next: { tags, revalidate: false },
  })
}
