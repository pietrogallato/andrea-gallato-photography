import { draftMode } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { risolviDestinazione } from '@/lib/preview/destinazione'
import { segretoCorretto } from '@/lib/preview/segreto'

/**
 * Apre la modalita anteprima e porta alla pagina chiesta.
 *
 * Due scelte reggono la sicurezza di questa rotta:
 *
 * 1. il segreto si confronta a **tempo costante**, perche il tempo di
 *    risposta di un confronto normale racconta quanti caratteri iniziali
 *    erano giusti;
 * 2. la destinazione si **ricostruisce** da `ROUTES` a partire da un tipo e
 *    uno slug vagliati, e non si prende mai dalla query string: sarebbe un
 *    open redirect sul dominio del sito.
 */
export async function GET(request: NextRequest) {
  const parametri = request.nextUrl.searchParams

  if (!segretoCorretto(process.env.SANITY_PREVIEW_SECRET, parametri.get('secret'))) {
    // Nessun dettaglio sul perche: distinguere «segreto mancante» da
    // «segreto sbagliato» e gia un indizio.
    return new NextResponse('Non autorizzato', { status: 401 })
  }

  const destinazione = risolviDestinazione({
    locale: parametri.get('locale'),
    tipo: parametri.get('type'),
    slug: parametri.get('slug'),
  })

  // Asincrona in Next 16.
  const anteprima = await draftMode()
  anteprima.enable()

  return NextResponse.redirect(new URL(destinazione, request.nextUrl.origin))
}
