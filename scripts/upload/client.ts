import { createClient, type SanityClient } from '@sanity/client'

/**
 * Client di scrittura per gli script di caricamento.
 *
 * Il dataset e esplicito e obbligatorio: questi script scrivono, e scrivere sul
 * dataset sbagliato e l'errore che costa di piu. `UPLOAD_DATASET` vince su
 * `NEXT_PUBLIC_SANITY_DATASET` proprio per poter puntare a `production` senza
 * toccare `.env.local`.
 */
export function makeUploadClient(): { client: SanityClient; dataset: string } {
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

  return { client, dataset }
}
