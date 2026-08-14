import {
  avviaLotto,
  segnaAvanzamento,
  segnaCreata,
  segnaDuplicato,
  segnaErrore,
  type StatoLotto,
} from './uploadState'

export type FileDaCaricare = { nome: string; file: File }

/**
 * Tutto cio che il lotto deve fare al mondo esterno, in un solo oggetto.
 *
 * Esiste per rendere l'orchestrazione verificabile senza uno Studio e senza
 * React: la parte difficile di questo modulo non e parlare con Sanity, e
 * l'ordine in cui lo fa.
 */
export type PortaCaricamento = {
  /** Carica l'asset riportando l'avanzamento. Risolve con l'id dell'asset. */
  caricaAsset(voce: FileDaCaricare, onAvanzamento: (percentuale: number) => void): Promise<string>
  /** La fotografia che gia usa quell'asset, se c'e. */
  trovaDuplicato(assetId: string): Promise<{ _id: string } | null>
  /** Il rank di ordinamento successivo, letto adesso. */
  prossimoRank(): Promise<string>
  /** Crea la bozza e restituisce il suo id. */
  creaBozza(input: { assetId: string; orderRank: string }): Promise<string>
}

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Esegue un caricamento multiplo.
 *
 * **I trasferimenti vanno in parallelo, il seguito no.** Deduplica, rank e
 * creazione passano da una coda a uno alla volta, perche `nextOrderRank`
 * legge il massimo e ci costruisce sopra: due chiamate concorrenti
 * partirebbero dallo stesso massimo e le due fotografie finirebbero nella
 * stessa posizione. Il collo di bottiglia e voluto e riguarda solo scritture
 * brevi, mentre la parte lenta — il trasferimento dei byte — resta parallela.
 *
 * Un fallimento riguarda un file solo: gli altri proseguono, e il lotto si
 * conclude con le bozze che sono riuscite.
 */
export async function eseguiLotto(
  files: FileDaCaricare[],
  porta: PortaCaricamento,
  onStato: (trasforma: (stato: StatoLotto) => StatoLotto) => void,
): Promise<void> {
  let coda: Promise<unknown> = Promise.resolve()

  /** Mette in fila il seguito del caricamento, uno alla volta. */
  const inSequenza = <T,>(passo: () => Promise<T>): Promise<T> => {
    const prossimo = coda.then(passo, passo)
    // La coda non deve interrompersi per un fallimento: il file successivo ha
    // diritto al suo turno.
    coda = prossimo.catch(() => undefined)
    return prossimo
  }

  await Promise.all(
    files.map(async (voce) => {
      try {
        const assetId = await porta.caricaAsset(voce, (percentuale) => {
          onStato((s) => segnaAvanzamento(s, voce.nome, percentuale))
        })

        await inSequenza(async () => {
          const esistente = await porta.trovaDuplicato(assetId)
          if (esistente) {
            onStato((s) => segnaDuplicato(s, voce.nome, esistente._id))
            return
          }

          const orderRank = await porta.prossimoRank()
          const bozzaId = await porta.creaBozza({ assetId, orderRank })
          onStato((s) => segnaCreata(s, voce.nome, bozzaId))
        })
      } catch (errore) {
        onStato((s) => segnaErrore(s, voce.nome, messaggio(errore)))
      }
    }),
  )
}

/** Stato iniziale del lotto, o del solo sottoinsieme che si riprova. */
export function statoIniziale(files: FileDaCaricare[], precedente?: StatoLotto): StatoLotto {
  return avviaLotto(
    files.map((f) => f.nome),
    precedente,
  )
}
