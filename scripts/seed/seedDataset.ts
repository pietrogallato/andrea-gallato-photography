import { createReadStream } from 'node:fs'
import path from 'node:path'
import { createClient } from '@sanity/client'
import { buildPlaceholderPlan, generatePlaceholders, OUTPUT_DIR } from './generatePlaceholders'
import { nextOrderRank } from '../../sanity/lib/orderRank'

const PHOTO_COUNT = Number(process.env.SEED_COUNT ?? 30)
const dataset = process.env.SEED_DATASET

if (!dataset) {
  console.error('SEED_DATASET e obbligatorio. Esempio: SEED_DATASET=development npm run seed')
  process.exit(1)
}

if (dataset === 'production') {
  console.error('Rifiuto di popolare production con placeholder.')
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

async function main() {
  console.log(`Genero ${PHOTO_COUNT} placeholder…`)
  await generatePlaceholders(PHOTO_COUNT)
  const plan = buildPlaceholderPlan(PHOTO_COUNT)

  const photoIds: string[] = []

  for (const [index, spec] of plan.entries()) {
    // _id deterministico: rieseguire lo script non duplica i documenti.
    const id = `seed-photo-${String(index + 1).padStart(3, '0')}`

    const existing = await client.fetch<{ _id: string } | null>(`*[_id == $id][0]{_id}`, { id })

    if (existing) {
      photoIds.push(id)
      console.log(`  ${spec.filename} gia presente, salto`)
      continue
    }

    const asset = await client.assets.upload(
      'image',
      createReadStream(path.join(OUTPUT_DIR, spec.filename)),
      { filename: spec.filename },
    )

    // orderRank va scritto esplicitamente: il plugin di ordinamento lo popola
    // solo via initialValue, che gira soltanto dal form dello Studio. Senza,
    // la foto sarebbe resa al 20% di opacita e non trascinabile.
    const orderRank = await nextOrderRank(client, 'photo')

    await client.createOrReplace({
      _id: id,
      _type: 'photo',
      image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
      altIt: `Placeholder ${index + 1}, rapporto ${spec.ratioName}`,
      altEn: `Placeholder ${index + 1}, ratio ${spec.ratioName}`,
      titleIt: `Studio ${index + 1}`,
      placeIt: 'Veneto',
      year: 2020 + (index % 6),
      showInGallery: true,
      orderRank,
    })

    photoIds.push(id)
    console.log(`  ${spec.filename} -> ${id}`)
  }

  await client.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    photographerName: 'Andrea Gallato',
    seoTitleIt: 'Andrea Gallato — Fotografia',
    seoTitleEn: 'Andrea Gallato — Photography',
    seoDescriptionIt: 'Fotografia di paesaggio, street e ritratto.',
    seoDescriptionEn: 'Landscape, street and portrait photography.',
    email: 'info@example.com',
  })

  await client.createOrReplace({
    _id: 'homePage',
    _type: 'homePage',
    heroPhoto: { _type: 'reference', _ref: photoIds[0] },
    introIt: 'Fotografia di paesaggio, street e ritratto.',
    introEn: 'Landscape, street and portrait photography.',
    selectedPhotos: photoIds.slice(0, 6).map((ref, i) => ({
      _type: 'reference',
      _ref: ref,
      _key: `sel-${i}`,
    })),
  })

  console.log(`\nFatto. ${photoIds.length} fotografie sul dataset "${dataset}".`)
  console.log('Nota: siteSettings non ha socialImage, obbligatoria per la pubblicazione.')
  console.log('Va caricata a mano dallo Studio prima di testare la pubblicazione.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
