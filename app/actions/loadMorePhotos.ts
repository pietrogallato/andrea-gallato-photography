'use server'

import { draftMode } from 'next/headers'
import { caricaRighe, type LoadMoreResult } from '@/lib/gallery/caricaRighe'
import type { Locale } from '@/lib/i18n/locales'

export type { LoadMoreResult }

/**
 * Il «Carica altre» della galleria.
 *
 * **Decide da se se siamo in anteprima**, leggendo il cookie invece di
 * accettare un argomento: un flag passato dal client non e una credenziale, e
 * chiunque potrebbe invocare l'azione con `preview: true` per leggere le
 * bozze.
 *
 * Chiamare `draftMode()` qui non rende dinamica nessuna pagina: una Server
 * Action gira sempre a tempo di richiesta. Il percorso di rendering usa
 * invece `caricaRighe`, che non la tocca.
 */
export async function loadMorePhotos(offset: number, locale: Locale): Promise<LoadMoreResult> {
  const { isEnabled } = await draftMode()
  return caricaRighe(offset, locale, isEnabled)
}
