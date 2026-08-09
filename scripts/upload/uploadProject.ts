import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { makeUploadClient } from './client'
import { ensurePhoto, photoIdFor } from './photoDoc'
import {
  CONCORSO_TRIESTE_DIR,
  CONCORSO_TRIESTE_PHOTOS,
  CONCORSO_TRIESTE_PROJECT,
} from './concorsoTrieste'

/**
 * Carica il lotto di un progetto e crea il documento `project`.
 *
 * Le fotografie del lotto nascono **fuori dalla galleria**: appartengono al
 * progetto. E il default voluto dallo schema, e una che sta gia in galleria —
 * perche caricata prima come scatto singolo — ci resta, perche il documento
 * esistente non viene toccato.
 */

const { client, dataset } = makeUploadClient()

async function main() {
  await stat(CONCORSO_TRIESTE_DIR).catch(() => {
    console.error(`Cartella non trovata: ${CONCORSO_TRIESTE_DIR}`)
    process.exit(1)
  })

  const workDir = path.join(os.tmpdir(), 'andrea-project-resized')
  await mkdir(workDir, { recursive: true })

  console.log(
    `Carico ${CONCORSO_TRIESTE_PHOTOS.length} fotografie del progetto sul dataset "${dataset}"…`,
  )

  // Sequenziale, non parallelo: ogni orderRank dipende dal precedente.
  const photoIds: string[] = []
  for (const spec of CONCORSO_TRIESTE_PHOTOS) {
    photoIds.push(
      await ensurePhoto(client, spec, {
        sourceDir: CONCORSO_TRIESTE_DIR,
        workDir,
        showInGallery: false,
      }),
    )
  }

  const p = CONCORSO_TRIESTE_PROJECT
  const coverId = photoIdFor(p.coverFilename)

  if (!photoIds.includes(coverId)) {
    throw new Error(`La copertina ${coverId} non e fra le fotografie del progetto`)
  }

  const before = await client.fetch<{ _id: string } | null>(`*[_id == $id][0]{_id}`, { id: p.id })

  // Crea-se-manca, come per le pagine singole: se Andrea ha gia riscritto
  // titolo, descrizione o sequenza dallo Studio, rieseguire non glieli disfa.
  await client.createIfNotExists({
    _id: p.id,
    _type: 'project',
    titleIt: p.titleIt,
    // Nessun `titleEn`: «Concorso Trieste» non e una traduzione da fare, e
    // `pickLocalized` lo serve anche in inglese marcandolo lang="it".
    descriptionIt: p.descriptionIt,
    descriptionEn: p.descriptionEn,
    slug: { _type: 'slug', current: p.slug },
    year: p.year,
    cover: { _type: 'reference', _ref: coverId },
    photos: photoIds.map((ref, i) => ({ _type: 'reference', _ref: ref, _key: `ph-${i}` })),
    featured: false,
  })

  console.log(
    before
      ? `\nIl progetto ${p.id} c'era gia: lasciato com'e.`
      : `\nProgetto creato: ${p.id} (/${p.slug}).`,
  )
  console.log(`Fatto. ${photoIds.length} fotografie sul dataset "${dataset}".`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
