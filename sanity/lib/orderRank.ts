import { LexoRank } from 'lexorank'
import type { SanityClient } from '@sanity/client'

/**
 * Calcola il rank di ordinamento successivo per un tipo di documento.
 *
 * Va usato da OGNI percorso di creazione programmatica (script di seed,
 * tool "Carica fotografie"): @sanity/orderable-document-list popola
 * orderRank solo tramite initialValue, che gira soltanto quando il
 * documento nasce dal form dello Studio.
 */
export async function nextOrderRank(
  client: Pick<SanityClient, 'fetch'>,
  type: string,
): Promise<string> {
  const highest = await client.fetch<string | null>(
    `*[_type == $type && defined(orderRank)] | order(orderRank desc)[0].orderRank`,
    { type },
  )

  return highest
    ? LexoRank.parse(highest).genNext().toString()
    : LexoRank.middle().toString()
}
