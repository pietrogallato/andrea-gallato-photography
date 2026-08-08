import { revalidateTag } from 'next/cache'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import { directTagsFor, type WebhookPayload } from '@/lib/revalidation/tags'
import { resolveDependentTags } from '@/lib/revalidation/dependents'

export async function POST(request: Request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const signature = request.headers.get(SIGNATURE_HEADER_NAME)

  // Il corpo di una Request Web si consuma UNA volta sola: si legge il testo
  // grezzo per la firma e poi lo si analizza. Chiamare request.json() dopo
  // lancerebbe, e riserializzare il JSON puo cambiare la codifica e far
  // fallire il confronto della firma in modo intermittente.
  const body = await request.text()

  // `isValidSignature` e asincrona da @sanity/webhook v4: senza await la
  // Promise e sempre truthy e ogni richiesta verrebbe accettata.
  if (!secret || !signature || !(await isValidSignature(body, signature, secret))) {
    return new Response(null, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(body) as WebhookPayload
  } catch {
    return new Response(null, { status: 400 })
  }

  const tags = new Set([...directTagsFor(payload), ...(await resolveDependentTags(payload))])

  // `{ expire: 0 }` e la forma raccomandata per i webhook: su Next 16 quella a
  // un solo argomento e deprecata e il default non scade immediatamente.
  for (const tag of tags) revalidateTag(tag, { expire: 0 })

  return Response.json({ revalidated: [...tags] })
}
