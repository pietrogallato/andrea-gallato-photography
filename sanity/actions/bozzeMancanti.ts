/**
 * Quali fotografie di un progetto non sono ancora pubblicate.
 *
 * Serve a un solo scopo: dire **quali**. Il blocco alla pubblicazione esiste
 * gia — i riferimenti forti lo impongono da soli — ma il messaggio nativo
 * dice che qualcosa non va senza dire che cosa, e l'editor si trova davanti a
 * un pulsante che rifiuta di funzionare.
 */

export type RiferimentoFotografia = { _ref: string }

export type BozzaMancante = { id: string; titolo: string }

/** Il prefisso con cui Sanity nomina le bozze. */
const PREFISSO_BOZZA = 'drafts.'

export const idBozza = (id: string) => `${PREFISSO_BOZZA}${id}`

/**
 * Gli id referenziati che non esistono come documento pubblicato.
 *
 * Confronta i riferimenti del progetto con l'elenco dei pubblicati. Duplicati
 * rimossi: la stessa fotografia puo comparire come copertina e dentro la
 * sequenza, ma nell'elenco va nominata una volta sola.
 */
export function riferimentiNonPubblicati(
  riferimenti: readonly (RiferimentoFotografia | null | undefined)[],
  pubblicati: readonly string[],
): string[] {
  const esistenti = new Set(pubblicati)
  const mancanti = new Set<string>()

  for (const r of riferimenti) {
    if (!r?._ref) continue
    if (!esistenti.has(r._ref)) mancanti.add(r._ref)
  }

  return [...mancanti]
}

/**
 * Il nome con cui presentare una fotografia ancora in bozza.
 *
 * Una fotografia puo non avere titolo: e un campo facoltativo. In quel caso
 * si ripiega sul testo alternativo, che invece e obbligatorio, e solo da
 * ultimo sull'id — che all'editor non dice nulla ma e meglio di una riga
 * vuota in un elenco di cose da sistemare.
 */
export function titoloDellaBozza(doc: {
  _id: string
  titleIt?: string | null
  titleEn?: string | null
  altIt?: string | null
}): BozzaMancante {
  const titolo =
    doc.titleIt?.trim() ||
    doc.titleEn?.trim() ||
    doc.altIt?.trim() ||
    doc._id.replace(PREFISSO_BOZZA, '')

  return { id: doc._id, titolo }
}

/** Il riassunto in una riga, al singolare o al plurale. */
export function riepilogo(quante: number): string {
  if (quante === 0) return 'Tutte le fotografie del progetto sono pubblicate.'
  if (quante === 1) return 'Una fotografia del progetto non e ancora pubblicata:'
  return `${quante} fotografie del progetto non sono ancora pubblicate:`
}
