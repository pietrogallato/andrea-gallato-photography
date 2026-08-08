export type WebhookPayload = {
  _id: string
  _type: string
  _rev?: string
  slug?: string | null
  previousSlug?: string | null
  operation?: 'create' | 'update' | 'delete' | string
}

/**
 * Tag invalidati direttamente da un documento cambiato.
 *
 * **Funzione pura**: nessuna chiamata di rete, deterministica, restituisce un
 * insieme senza ripetizioni. È la proprietà che la rende testabile per intero.
 *
 * Le dipendenze inverse — quali pagine mostrano una certa fotografia — non
 * possono stare qui: le sotto-query sono vietate nelle proiezioni dei webhook
 * Sanity, quindi quell'informazione non arriva nel payload e va chiesta dal
 * route handler (vedi `dependents.ts`).
 */
export function directTagsFor(payload: WebhookPayload): string[] {
  const tags = new Set<string>()

  switch (payload._type) {
    case 'photo':
      // Una fotografia compare in galleria; le pagine che la referenziano
      // vengono risolte separatamente.
      tags.add('gallery')
      break

    case 'project':
      tags.add('projects-index')
      tags.add('sitemap')
      if (payload.slug) tags.add(`project:${payload.slug}`)
      // Al cambio di slug il vecchio percorso resterebbe servito dalla cache
      // a tempo indeterminato: con i tag la scadenza a tempo è disattivata.
      if (payload.previousSlug) tags.add(`project:${payload.previousSlug}`)
      break

    case 'homePage':
      tags.add('home')
      break

    case 'aboutPage':
      tags.add('about')
      break

    case 'siteSettings':
      // Nome, metadati SEO e immagine social compaiono su ogni pagina.
      tags.add('settings')
      tags.add('home')
      tags.add('gallery')
      tags.add('projects-index')
      tags.add('about')
      tags.add('sitemap')
      break

    default:
      // Un tipo non previsto non deve far fallire la revalidation degli altri.
      break
  }

  return [...tags]
}
