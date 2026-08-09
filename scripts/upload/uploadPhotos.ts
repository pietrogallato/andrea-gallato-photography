import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { makeUploadClient } from './client'
import { ensurePhoto, photoIdFor } from './photoDoc'
import { ANDREA_PHOTOS } from './andreaPhotos'
import { ensureSingletons } from './singletons'

/**
 * Carica le fotografie di galleria di Andrea come documenti `photo`
 * indipendenti, e si assicura che le tre pagine singole esistano.
 *
 * Non tocca i progetti: queste fotografie non ne fanno parte.
 *
 * Idempotente: l'`_id` di ogni documento deriva dal nome del file, quindi
 * rieseguire lo script riusa cio che c'e invece di duplicarlo.
 */

/**
 * La fotografia di apertura, ed e la stessa che si vede condividendo il link.
 * Orizzontale di proposito: la fascia della home e larga, e l'anteprima
 * social vuole 1200x630.
 */
const HERO_FILENAME = 'DSC_0098-4.jpg'

const SOURCE_DIR =
  process.env.PHOTOS_DIR ?? path.join(os.homedir(), 'Downloads', 'Foto sito Andrea')

const { client, dataset } = makeUploadClient()

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

  // Sequenziale, non parallelo: ogni orderRank dipende dal precedente.
  const ids: string[] = []
  for (const spec of ANDREA_PHOTOS) {
    ids.push(await ensurePhoto(client, spec, { sourceDir: SOURCE_DIR, workDir, showInGallery: true }))
  }

  const hidden = await hidePlaceholders()
  if (hidden > 0) console.log(`\nTolti dalla galleria ${hidden} placeholder del seed.`)

  const heroId = photoIdFor(HERO_FILENAME)

  // L'asset e gia nel dataset: `socialImage` puo puntarci senza ricaricarlo.
  const socialAssetId = await client.fetch<string | null>(`*[_id == $id][0].image.asset._ref`, {
    id: heroId,
  })
  if (!socialAssetId) throw new Error(`Asset non trovato per ${heroId}`)

  const created = await ensureSingletons(client, { heroPhotoId: heroId, socialAssetId })
  if (created.length > 0) console.log(`Pagine create: ${created.join(', ')}.`)

  // `setIfMissing`, non `set`: se Andrea ha gia scelto la fotografia di
  // apertura dallo Studio, rieseguire lo script non deve disfare la sua scelta.
  const homePage = await client.fetch<{ _id: string } | null>(`*[_type == "homePage"][0]{_id}`)
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
