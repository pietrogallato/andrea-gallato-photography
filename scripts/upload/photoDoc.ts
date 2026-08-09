import { createReadStream } from 'node:fs'
import path from 'node:path'
import type { SanityClient } from '@sanity/client'
import sharp from 'sharp'
import { slugForFilename } from './slug'
import { nextOrderRank } from '../../sanity/lib/orderRank'

/** Il lato lungo oltre cui si ridimensiona prima di caricare. */
export const MAX_EDGE = 4000

export type PhotoSpec = {
  /** Nome del file dentro la cartella sorgente del lotto. */
  filename: string
  /** Titolo dell'autore. Assente dove il nome del file e un nome di lavoro. */
  titleEn?: string
  altIt: string
  altEn: string
  year: number
}

/**
 * L'`_id` deriva dal nome del file.
 *
 * E cio che rende i caricamenti rieseguibili, ed e anche il motivo per cui una
 * stessa fotografia usata in due lotti diversi non si duplica: stesso nome,
 * stesso documento. Serve esattamente qui, perche «Wedding Day, Ordinary
 * Street» sta sia fra le fotografie di galleria sia dentro un progetto.
 */
export function photoIdFor(filename: string): string {
  return `photo-${slugForFilename(filename)}`
}

/**
 * Percorso del file da caricare, ridimensionato solo se serve.
 *
 * Oltre i 4000px di lato lungo non si guadagna nulla: il gradino piu alto
 * della scala di larghezze del sito e 3840.
 */
async function fileToUpload(
  sourceDir: string,
  filename: string,
  workDir: string,
): Promise<string> {
  const source = path.join(sourceDir, filename)
  const meta = await sharp(source).metadata()
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)

  if (longEdge <= MAX_EDGE) return source

  const destination = path.join(workDir, filename)
  await sharp(source)
    // Applica l'orientamento EXIF e lo azzera, cosi il ritaglio non dipende dal
    // tag. Con `fit: inside` il vincolo vale sul lato lungo, qualunque sia
    // l'orientamento.
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .withMetadata()
    .toFile(destination)

  console.log(`  ridimensionata da ${longEdge}px a ${MAX_EDGE}px: ${filename}`)
  return destination
}

/**
 * Crea il documento `photo` se non c'e gia, e restituisce il suo `_id`.
 *
 * Non sovrascrive: una fotografia gia caricata viene riusata cosi com'e,
 * comprese le modifiche fatte dallo Studio.
 */
export async function ensurePhoto(
  client: SanityClient,
  spec: PhotoSpec,
  {
    sourceDir,
    workDir,
    showInGallery,
  }: { sourceDir: string; workDir: string; showInGallery: boolean },
): Promise<string> {
  const id = photoIdFor(spec.filename)

  const existing = await client.fetch<{ _id: string } | null>(`*[_id == $id][0]{_id}`, { id })
  if (existing) {
    console.log(`  ${spec.filename} gia presente (${id}), riuso`)
    return id
  }

  const source = await fileToUpload(sourceDir, spec.filename, workDir)
  const asset = await client.assets.upload('image', createReadStream(source), {
    filename: spec.filename,
  })

  // orderRank va scritto esplicitamente: @sanity/orderable-document-list lo
  // popola solo via initialValue, che gira soltanto dal form dello Studio.
  // Senza, la foto sarebbe resa al 20% di opacita e non trascinabile.
  // Il calcolo e sequenziale di proposito: ogni rank dipende dal precedente.
  const orderRank = await nextOrderRank(client, 'photo')

  await client.createOrReplace({
    _id: id,
    _type: 'photo',
    image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
    altIt: spec.altIt,
    altEn: spec.altEn,
    ...(spec.titleEn ? { titleEn: spec.titleEn } : {}),
    year: spec.year,
    showInGallery,
    orderRank,
  })

  console.log(`  ${spec.filename} -> ${id}`)
  return id
}
