import { draftMode } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { risolviDestinazione } from '@/lib/preview/destinazione'

/**
 * Chiude la modalita anteprima.
 *
 * Non chiede il segreto: uscire dall'anteprima non da accesso a nulla, e
 * pretendere una credenziale per **smettere** di vedere le bozze sarebbe un
 * ostacolo senza contropartita. La destinazione resta comunque ricostruita da
 * `ROUTES`, per la stessa ragione dell'altra rotta.
 */
export async function GET(request: NextRequest) {
  const parametri = request.nextUrl.searchParams

  const destinazione = risolviDestinazione({
    locale: parametri.get('locale'),
    tipo: parametri.get('type'),
    slug: parametri.get('slug'),
  })

  const anteprima = await draftMode()
  anteprima.disable()

  return NextResponse.redirect(new URL(destinazione, request.nextUrl.origin))
}
