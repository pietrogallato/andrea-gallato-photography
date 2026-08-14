import { describe, it, expect, vi } from 'vitest'
import { eseguiLotto, statoIniziale, type FileDaCaricare, type PortaCaricamento } from '../eseguiLotto'
import type { StatoLotto } from '../uploadState'

const voci = (...nomi: string[]): FileDaCaricare[] =>
  nomi.map((nome) => ({ nome, file: {} as File }))

/** Promise che si risolve quando lo decide il test. */
function differita<T>() {
  let risolvi!: (v: T) => void
  let rifiuta!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    risolvi = res
    rifiuta = rej
  })
  return { promise, risolvi, rifiuta }
}

/** Porta di comodo: tutto riesce, e registra l ordine delle chiamate. */
function portaFinta(override: Partial<PortaCaricamento> = {}) {
  const tracce: string[] = []
  let contatore = 0

  const porta: PortaCaricamento = {
    caricaAsset: vi.fn(async (voce) => {
      tracce.push(`upload:${voce.nome}`)
      return `asset-${voce.nome}`
    }),
    trovaDuplicato: vi.fn(async () => null),
    prossimoRank: vi.fn(async () => {
      tracce.push('rank')
      return `rank-${++contatore}`
    }),
    creaBozza: vi.fn(async ({ orderRank }) => {
      tracce.push(`crea:${orderRank}`)
      return `drafts.doc-${orderRank}`
    }),
    ...override,
  }

  return { porta, tracce }
}

function raccogliStato(iniziale: StatoLotto) {
  let stato = iniziale
  return {
    onStato: (t: (s: StatoLotto) => StatoLotto) => {
      stato = t(stato)
    },
    get corrente() {
      return stato
    },
  }
}

describe('eseguiLotto', () => {
  it('crea una bozza per ogni file, con il proprio rank', async () => {
    const files = voci('a.jpg', 'b.jpg')
    const { porta } = portaFinta()
    const s = raccogliStato(statoIniziale(files))

    await eseguiLotto(files, porta, s.onStato)

    expect(s.corrente.file.map((f) => f.stato)).toEqual(['creata', 'creata'])
    expect(new Set(s.corrente.file.map((f) => f.documentoId)).size).toBe(2)
  })

  /**
   * La ragione d essere di questo modulo. `nextOrderRank` legge il massimo e
   * ci costruisce sopra: se due file chiedessero il rank prima che l altro
   * abbia scritto, otterrebbero lo stesso valore e finirebbero nella stessa
   * posizione. Qui si verifica che fra un `rank` e la sua `crea` non si
   * infili mai il `rank` di un altro file.
   */
  it('serializza rank e creazione, senza interleaving fra file', async () => {
    const files = voci('a.jpg', 'b.jpg', 'c.jpg')
    const { porta, tracce } = portaFinta()

    await eseguiLotto(files, porta, () => {})

    const soloSeguito = tracce.filter((t) => t !== `upload:a.jpg`).filter((t) => !t.startsWith('upload:'))
    // Attesa: rank, crea, rank, crea, rank, crea — mai due rank di fila.
    expect(soloSeguito).toEqual([
      'rank', 'crea:rank-1',
      'rank', 'crea:rank-2',
      'rank', 'crea:rank-3',
    ])
  })

  it('trasferisce i file in parallelo, senza aspettare il precedente', async () => {
    const primo = differita<string>()
    const iniziati: string[] = []

    const { porta } = portaFinta({
      caricaAsset: vi.fn(async (voce) => {
        iniziati.push(voce.nome)
        if (voce.nome === 'a.jpg') return primo.promise
        return `asset-${voce.nome}`
      }),
    })

    const files = voci('a.jpg', 'b.jpg')
    const esecuzione = eseguiLotto(files, porta, () => {})

    // Il secondo trasferimento e partito benche il primo sia ancora in volo:
    // se fossero in sequenza, `iniziati` avrebbe un solo elemento.
    await vi.waitFor(() => expect(iniziati).toEqual(['a.jpg', 'b.jpg']))

    primo.risolvi('asset-a.jpg')
    await esecuzione
  })

  it('un duplicato non crea nulla e porta l id esistente', async () => {
    const files = voci('a.jpg')
    const { porta } = portaFinta({ trovaDuplicato: vi.fn(async () => ({ _id: 'photo-the-wall' })) })
    const s = raccogliStato(statoIniziale(files))

    await eseguiLotto(files, porta, s.onStato)

    expect(porta.creaBozza).not.toHaveBeenCalled()
    expect(s.corrente.file[0]).toMatchObject({ stato: 'duplicato', documentoId: 'photo-the-wall' })
  })

  it('un trasferimento fallito non ferma gli altri', async () => {
    const files = voci('a.jpg', 'b.jpg')
    const { porta } = portaFinta({
      caricaAsset: vi.fn(async (voce) => {
        if (voce.nome === 'a.jpg') throw new Error('rete assente')
        return `asset-${voce.nome}`
      }),
    })
    const s = raccogliStato(statoIniziale(files))

    await eseguiLotto(files, porta, s.onStato)

    expect(s.corrente.file.find((f) => f.nome === 'a.jpg')).toMatchObject({
      stato: 'errore',
      errore: 'rete assente',
    })
    expect(s.corrente.file.find((f) => f.nome === 'b.jpg')!.stato).toBe('creata')
  })

  /**
   * Se un fallimento interrompesse la coda, i file dopo di esso resterebbero
   * per sempre in caricamento: nessun esito, e un retry che non sa cosa
   * riprendere.
   */
  it('un fallimento nel seguito non blocca la coda dei file successivi', async () => {
    const files = voci('a.jpg', 'b.jpg')
    const { porta } = portaFinta({
      trovaDuplicato: vi.fn(async (assetId: string) => {
        if (assetId === 'asset-a.jpg') throw new Error('query fallita')
        return null
      }),
    })
    const s = raccogliStato(statoIniziale(files))

    await eseguiLotto(files, porta, s.onStato)

    expect(s.corrente.file.find((f) => f.nome === 'a.jpg')!.stato).toBe('errore')
    expect(s.corrente.file.find((f) => f.nome === 'b.jpg')!.stato).toBe('creata')
  })

  it('riporta l avanzamento del trasferimento', async () => {
    const files = voci('a.jpg')
    const { porta } = portaFinta({
      caricaAsset: vi.fn(async (voce, onAvanzamento) => {
        onAvanzamento(30)
        onAvanzamento(80)
        return `asset-${voce.nome}`
      }),
    })

    const visti: number[] = []
    let stato = statoIniziale(files)
    await eseguiLotto(files, porta, (t) => {
      stato = t(stato)
      visti.push(stato.file[0].percentuale)
    })

    expect(visti.slice(0, 2)).toEqual([30, 80])
  })
})
