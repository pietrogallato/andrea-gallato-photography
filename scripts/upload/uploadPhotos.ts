import { createReadStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createClient } from '@sanity/client'
import sharp from 'sharp'
import { ANDREA_PHOTOS, type PhotoSpec } from './andreaPhotos'
import { slugForFilename } from './slug'
import { ensureSingletons } from './singletons'
import { nextOrderRank } from '../../sanity/lib/orderRank'

/**
 * La fotografia di apertura, e la stessa che si vede condividendo il link.
 * Orizzontale di proposito: la fascia della home e larga, e l'anteprima
 * social vuole 1200x630.
 */
const HERO_FILENAME = 'DSC_0098-4.jpg'

/**
 * Carica le fotografie di Andrea come documenti `photo` indipendenti.
 *
 * Non tocca i progetti: queste fotografie non ne fanno parte.
 *
 * Idempotente: l'`_id` di ogni documento deriva dal nome del file, quindi
 * rieseguire lo script salta ciò che c'è già invece di duplicarlo.
 */

/** Il lato lungo oltre cui si ridimensiona prima di caricare. */
const MAX_EDGE = 4000

const SOURCE_DIR =
  process.env.PHOTOS_DIR ?? path.join(os.homedir(), 'Downloads', 'Foto sito Andrea')

const dataset = process.env.UPLOAD_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET

if (!dataset) {
  console.error('UPLOAD_DATASET (o NEXT_PUBLIC_SANITY_DATASET) e obbligatorio.')
  process.exit(1)
}

const token = process.env.SANITY_WRITE_TOKEN
if (!token) {
  console.error('SANITY_WRITE_TOKEN e obbligatorio. Va in .env.local, non in .env.example.')
  process.exit(1)
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  token,
  useCdn: false,
})

/**
 * Restituisce il percorso del file da caricare, ridimensionando solo se serve.
 *
 * Il lato lungo oltre 4000px non migliora nulla: il gradino piu alto della
 * scala di larghezze e 3840. Ridimensionare qui riduce upload e tempo di
 * elaborazione senza perdita visibile.
 */
async function fileToUpload(filename: string, workDir: string): Promise<string> {
  const source = path.join(SOURCE_DIR, filename)
  const meta = await sharp(source).metadata()
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)

  if (longEdge <= MAX_EDGE) return source

  const destination = path.join(workDir, filename)
  await sharp(source)
    // Applica l'orientamento EXIF e lo azzera, cosi il ritaglio non dipende
    // dal tag. Con `fit: inside` il vincolo vale sul lato lungo, qualunque
    // sia l'orientamento.
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .withMetadata()
    .toFile(destination)

  console.log(`  ridimensionata da ${longEdge}px a ${MAX_EDGE}px: ${filename}`)
  return destination
}

async function uploadOne(spec: PhotoSpec, workDir: string): Promise<string> {
  const id = `photo-${slugForFilename(spec.filename)}`

  const existing = await client.fetch<{ _id: string } | null>(`*[_id == $id][0]{_id}`, { id })
  if (existing) {
    console.log(`  ${spec.filename} gia presente (${id}), salto`)
    return id
  }

  const source = await fileToUpload(spec.filename, workDir)
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
    showInGallery: true,
    orderRank,
  })

  console.log(`  ${spec.filename} -> ${id}`)
  return id
}

/**
 * Toglie dalla galleria i 30 placeholder del seed.
 *
 * Restano nel dataset perche i due progetti di esempio li referenziano, e un
 * riferimento rotto e peggio di un placeholder nascosto.
 */
async function hidePlaceholders(): Promise<number> {
  const ids = await client.fetch<string[]>(
    `*[_type == "photo" && string::startsWith(_id, "seed-photo-") && showInGallery == true]._id`,
  )
  if (ids.length === 0) return 0

  const tx = ids.reduce(
    (acc, id) => acc.patch(id, (p) => p.set({ showInGallery: false })),
    client.transaction(),
  )
  await tx.commit()
  return ids.length
}

async function main() {
  await stat(SOURCE_DIR).catch(() => {
    console.error(`Cartella non trovata: ${SOURCE_DIR}`)
    process.exit(1)
  })

  const workDir = path.join(os.tmpdir(), 'andrea-photos-resized')
  await mkdir(workDir, { recursive: true })

  console.log(`Carico ${ANDREA_PHOTOS.length} fotografie sul dataset "${dataset}"…`)

  const ids: string[] = []
  for (const spec of ANDREA_PHOTOS) {
    ids.push(await uploadOne(spec, workDir))
  }

  const hidden = await hidePlaceholders()
  if (hidden > 0) console.log(`\nTolti dalla galleria ${hidden} placeholder del seed.`)

  const heroId = `photo-${slugForFilename(HERO_FILENAME)}`

  // L'asset e gia nel dataset: `socialImage` puo puntarci senza ricaricarlo.
  const socialAssetId = await client.fetch<string | null>(
    `*[_id == $id][0].image.asset._ref`,
    { id: heroId },
  )
  if (!socialAssetId) throw new Error(`Asset non trovato per ${heroId}`)

  const created = await ensureSingletons(client, { heroPhotoId: heroId, socialAssetId })
  if (created.length > 0) console.log(`Pagine create: ${created.join(', ')}.`)

  // `setIfMissing`, non `set`: se Andrea ha gia scelto la fotografia di
  // apertura dallo Studio, rieseguire lo script non deve disfare la sua scelta.
  const homePage = await client.fetch<{ _id: string } | null>(
    `*[_type == "homePage"][0]{_id}`,
  )
  if (homePage) {
    await client
      .patch(homePage._id)
      .setIfMissing({ heroPhoto: { _type: 'reference', _ref: heroId } })
      .commit()
  }

  console.log(`\nFatto. ${ids.length} fotografie sul dataset "${dataset}".`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
