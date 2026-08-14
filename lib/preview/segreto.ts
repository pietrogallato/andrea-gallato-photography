import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Confronto a tempo costante fra il segreto atteso e quello ricevuto.
 *
 * Un `===` fra stringhe esce al primo carattere diverso, e il tempo di
 * risposta racconta quanti caratteri iniziali erano giusti: con abbastanza
 * tentativi il segreto si ricostruisce un carattere alla volta.
 *
 * Si confrontano i digest e non le stringhe perche `timingSafeEqual` pretende
 * due buffer della stessa lunghezza — e la lunghezza stessa del segreto
 * atteso e un'informazione da non regalare.
 */
export function segretoCorretto(atteso: string | undefined, ricevuto: string | null): boolean {
  // Senza un segreto configurato l'anteprima non si apre: negare e l'unico
  // comportamento sicuro, perche l'alternativa e un accesso libero alle bozze.
  if (!atteso) return false
  if (!ricevuto) return false

  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(atteso), digest(ricevuto))
}
