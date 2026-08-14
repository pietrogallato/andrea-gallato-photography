import type { SanityClient } from '@sanity/client'

export type PhotoEsistente = { _id: string }

/**
 * Cerca una fotografia che usi gia questo asset.
 *
 * **`perspective: 'raw'` non e un dettaglio.** La perspective predefinita e
 * `published`: senza `raw` la query non vedrebbe le bozze, comprese quelle che
 * il tool stesso ha appena creato. Caricando due volte lo stesso file nella
 * stessa sessione si otterrebbero due documenti invece di una segnalazione.
 *
 * **La deduplica di Sanity copre solo i file byte-identici.** Una
 * riesportazione della stessa fotografia produce un asset diverso e non viene
 * rilevata qui: e un limite da dire all'editor, non da nascondere.
 */
export async function findDuplicatePhoto(
  client: SanityClient,
  assetId: string,
): Promise<PhotoEsistente | null> {
  const trovati = await client
    .withConfig({ perspective: 'raw' })
    .fetch<PhotoEsistente[] | null>(
      `*[_type == "photo" && image.asset._ref == $assetId]{_id}`,
      { assetId },
    )

  if (!trovati?.length) return null

  // `drafts.x` e `x` sono lo stesso documento, non due. Si preferisce il
  // pubblicato: e quello che l'editor si aspetta di vedere aprendo il
  // collegamento.
  return trovati.find((d) => !d._id.startsWith('drafts.')) ?? trovati[0]
}
