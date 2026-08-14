/**
 * Lo stato di un caricamento multiplo, come logica pura.
 *
 * Vive fuori dalla UI di proposito: il tool dello Studio la rende, non la
 * contiene. Ogni file ha uno stato **indipendente** dagli altri — e la
 * proprieta che rende un fallimento parziale una seccatura invece che un
 * lotto da rifare.
 */

export type StatoFile = 'in-attesa' | 'caricamento' | 'creata' | 'duplicato' | 'errore'

export type FileDelLotto = {
  nome: string
  stato: StatoFile
  /** Da 0 a 100. Per gli esiti conclusi vale 100. */
  percentuale: number
  /** La bozza creata, oppure la fotografia gia esistente se duplicato. */
  documentoId?: string
  errore?: string
}

export type StatoLotto = { file: FileDelLotto[] }

export type EsitoLotto = 'in-corso' | 'concluso' | 'concluso-con-errori'

/** Gli stati da cui non ci si muove piu senza un nuovo tentativo. */
const CONCLUSI: ReadonlySet<StatoFile> = new Set<StatoFile>(['creata', 'duplicato', 'errore'])

const limita = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/**
 * Apre un lotto, oppure riapre alcuni file dentro un lotto esistente.
 *
 * Con `precedente` i file elencati tornano in attesa e **tutti gli altri
 * restano come sono**: e il retry selettivo. Ricaricare anche i riusciti
 * creerebbe i doppioni che la deduplica esiste per evitare.
 */
export function avviaLotto(nomi: string[], precedente?: StatoLotto): StatoLotto {
  const azzerato = (nome: string): FileDelLotto => ({ nome, stato: 'in-attesa', percentuale: 0 })

  if (!precedente) return { file: nomi.map(azzerato) }

  const daAzzerare = new Set(nomi)
  return { file: precedente.file.map((f) => (daAzzerare.has(f.nome) ? azzerato(f.nome) : f)) }
}

/** Applica una modifica a un solo file, lasciando gli altri intatti. */
function aggiorna(
  stato: StatoLotto,
  nome: string,
  modifica: (f: FileDelLotto) => FileDelLotto,
): StatoLotto {
  // Un nome estraneo non e un errore da propagare: un evento in ritardo di un
  // lotto precedente non deve far cadere la UI.
  if (!stato.file.some((f) => f.nome === nome)) return stato

  return { file: stato.file.map((f) => (f.nome === nome ? modifica(f) : f)) }
}

export function segnaAvanzamento(stato: StatoLotto, nome: string, percentuale: number): StatoLotto {
  return aggiorna(stato, nome, (f) => ({
    ...f,
    stato: 'caricamento',
    percentuale: limita(percentuale),
  }))
}

export function segnaCreata(stato: StatoLotto, nome: string, documentoId: string): StatoLotto {
  return aggiorna(stato, nome, (f) => ({
    ...f,
    stato: 'creata',
    percentuale: 100,
    documentoId,
    errore: undefined,
  }))
}

/**
 * Il duplicato e un **esito**, non un errore: il file e arrivato, esisteva
 * gia. Se finisse fra gli errori entrerebbe nel retry, e riprovare creerebbe
 * davvero il doppione che si voleva evitare.
 */
export function segnaDuplicato(stato: StatoLotto, nome: string, documentoId: string): StatoLotto {
  return aggiorna(stato, nome, (f) => ({
    ...f,
    stato: 'duplicato',
    percentuale: 100,
    documentoId,
    errore: undefined,
  }))
}

export function segnaErrore(stato: StatoLotto, nome: string, errore: string): StatoLotto {
  return aggiorna(stato, nome, (f) => ({ ...f, stato: 'errore', errore }))
}

/** I soli file che un nuovo tentativo deve toccare. */
export function daRiprovare(stato: StatoLotto): string[] {
  return stato.file.filter((f) => f.stato === 'errore').map((f) => f.nome)
}

/** Media delle percentuali. Un lotto vuoto non ha nulla da attendere. */
export function avanzamentoComplessivo(stato: StatoLotto): number {
  if (stato.file.length === 0) return 100

  const somma = stato.file.reduce((acc, f) => acc + f.percentuale, 0)
  return limita(somma / stato.file.length)
}

export function esitoDelLotto(stato: StatoLotto): EsitoLotto {
  if (!stato.file.every((f) => CONCLUSI.has(f.stato))) return 'in-corso'
  return stato.file.some((f) => f.stato === 'errore') ? 'concluso-con-errori' : 'concluso'
}
