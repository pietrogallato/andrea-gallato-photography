import { publicClient } from '@/lib/sanity/client'
import type { WebhookPayload } from './tags'

/**
 * Dipendenze inverse: quali pagine mostrano il documento cambiato.
 *
 * Le sotto-query sono **vietate** nelle proiezioni dei webhook Sanity, quindi
 * questa informazione non puo arrivare nel payload e va chiesta qui. E il
 * motivo per cui `directTagsFor` resta pura e questa funzione e separata.
 *
 * Non si tagga per fotografia sulle pagine di progetto: Next limita a 128 i
 * tag per fetch, e un progetto con piu di ~125 scatti supererebbe il limite
 * con comportamento non definito. Il tag di aggregazione `project:<slug>` e
 * costante e non ha quel problema.
 */
export async function resolveDependentTags(payload: WebhookPayload): Promise<string[]> {
  if (payload._type !== 'photo') return []

  const referenti = await publicClient.fetch<{ slug: string | null; type: string }[]>(
    `*[_type in ["project", "homePage"] && references($id)]{
      "slug": slug.current,
      "type": _type
    }`,
    { id: payload._id },
  )

  const tags = new Set<string>()

  for (const r of referenti ?? []) {
    if (r.type === 'homePage') tags.add('home')
    if (r.type === 'project' && r.slug) {
      tags.add(`project:${r.slug}`)
      tags.add('projects-index')
    }
  }

  return [...tags]
}
