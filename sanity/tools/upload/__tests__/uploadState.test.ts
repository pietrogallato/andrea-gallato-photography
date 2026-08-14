import { describe, it, expect } from 'vitest'
import {
  avviaLotto,
  segnaAvanzamento,
  segnaCreata,
  segnaDuplicato,
  segnaErrore,
  daRiprovare,
  avanzamentoComplessivo,
  esitoDelLotto,
  type StatoLotto,
} from '../uploadState'

const NOMI = ['a.jpg', 'b.jpg', 'c.jpg']

function lotto(): StatoLotto {
  return avviaLotto(NOMI)
}

describe('avviaLotto', () => {
  it('mette ogni file in attesa, senza percentuale', () => {
    const s = lotto()
    expect(s.file.map((f) => f.stato)).toEqual(['in-attesa', 'in-attesa', 'in-attesa'])
    expect(s.file.every((f) => f.percentuale === 0)).toBe(true)
  })

  it('conserva l ordine in cui i file sono stati scelti', () => {
    expect(lotto().file.map((f) => f.nome)).toEqual(NOMI)
  })
})

describe('transizioni', () => {
  it('l avanzamento porta il file in caricamento', () => {
    const s = segnaAvanzamento(lotto(), 'a.jpg', 42)
    const a = s.file.find((f) => f.nome === 'a.jpg')!
    expect(a.stato).toBe('caricamento')
    expect(a.percentuale).toBe(42)
  })

  it('la percentuale resta fra zero e cento', () => {
    const s = segnaAvanzamento(segnaAvanzamento(lotto(), 'a.jpg', 140), 'b.jpg', -20)
    expect(s.file.find((f) => f.nome === 'a.jpg')!.percentuale).toBe(100)
    expect(s.file.find((f) => f.nome === 'b.jpg')!.percentuale).toBe(0)
  })

  it('la creazione porta a `creata` con l id del documento', () => {
    const s = segnaCreata(lotto(), 'a.jpg', 'drafts.photo-1')
    const a = s.file.find((f) => f.nome === 'a.jpg')!
    expect(a.stato).toBe('creata')
    expect(a.documentoId).toBe('drafts.photo-1')
    expect(a.percentuale).toBe(100)
  })

  /**
   * Un duplicato non e un fallimento: il file e arrivato, semplicemente
   * esisteva gia. Trattarlo come errore lo farebbe finire nel retry, e
   * riprovare creerebbe davvero il doppione che si voleva evitare.
   */
  it('il duplicato e un esito, non un errore, e porta l id esistente', () => {
    const s = segnaDuplicato(lotto(), 'a.jpg', 'photo-the-wall')
    const a = s.file.find((f) => f.nome === 'a.jpg')!
    expect(a.stato).toBe('duplicato')
    expect(a.documentoId).toBe('photo-the-wall')
    expect(daRiprovare(s)).toEqual([])
  })

  it('l errore conserva il messaggio', () => {
    const a = segnaErrore(lotto(), 'a.jpg', 'rete assente').file.find((f) => f.nome === 'a.jpg')!
    expect(a.stato).toBe('errore')
    expect(a.errore).toBe('rete assente')
  })

  it('ignora un nome che non appartiene al lotto invece di rompersi', () => {
    expect(segnaErrore(lotto(), 'mai-vista.jpg', 'x')).toEqual(lotto())
  })
})

describe('isolamento fra file', () => {
  it('un fallimento non tocca lo stato degli altri', () => {
    let s = segnaCreata(lotto(), 'a.jpg', 'drafts.1')
    s = segnaAvanzamento(s, 'c.jpg', 30)
    s = segnaErrore(s, 'b.jpg', 'rete assente')

    expect(s.file.find((f) => f.nome === 'a.jpg')!.stato).toBe('creata')
    expect(s.file.find((f) => f.nome === 'c.jpg')!.percentuale).toBe(30)
  })
})

describe('retry', () => {
  it('riguarda solo i falliti', () => {
    let s = segnaCreata(lotto(), 'a.jpg', 'drafts.1')
    s = segnaErrore(s, 'b.jpg', 'rete assente')
    s = segnaDuplicato(s, 'c.jpg', 'photo-x')

    expect(daRiprovare(s)).toEqual(['b.jpg'])
  })

  it('riportare in attesa i falliti non disfa cio che era riuscito', () => {
    let s = segnaCreata(lotto(), 'a.jpg', 'drafts.1')
    s = segnaErrore(s, 'b.jpg', 'rete assente')

    const ripreso = avviaLotto(daRiprovare(s), s)

    expect(ripreso.file.find((f) => f.nome === 'a.jpg')!.stato).toBe('creata')
    expect(ripreso.file.find((f) => f.nome === 'b.jpg')!.stato).toBe('in-attesa')
    expect(ripreso.file.find((f) => f.nome === 'b.jpg')!.errore).toBeUndefined()
  })
})

describe('avanzamentoComplessivo', () => {
  it('parte da zero e arriva a cento', () => {
    expect(avanzamentoComplessivo(lotto())).toBe(0)

    let s = lotto()
    for (const nome of NOMI) s = segnaCreata(s, nome, 'drafts.x')
    expect(avanzamentoComplessivo(s)).toBe(100)
  })

  it('media i singoli senza superare il cento', () => {
    let s = segnaAvanzamento(lotto(), 'a.jpg', 100)
    s = segnaAvanzamento(s, 'b.jpg', 50)
    expect(avanzamentoComplessivo(s)).toBe(50)
  })

  it('conta i duplicati come conclusi: non c e piu nulla da attendere', () => {
    let s = segnaDuplicato(lotto(), 'a.jpg', 'photo-x')
    s = segnaDuplicato(s, 'b.jpg', 'photo-y')
    s = segnaDuplicato(s, 'c.jpg', 'photo-z')
    expect(avanzamentoComplessivo(s)).toBe(100)
  })

  it('su un lotto vuoto non divide per zero', () => {
    expect(avanzamentoComplessivo(avviaLotto([]))).toBe(100)
  })
})

describe('esitoDelLotto', () => {
  it('e in corso finche qualcosa non ha concluso', () => {
    expect(esitoDelLotto(segnaAvanzamento(lotto(), 'a.jpg', 10))).toBe('in-corso')
  })

  it('e concluso quando ogni file ha un esito', () => {
    let s = segnaCreata(lotto(), 'a.jpg', 'drafts.1')
    s = segnaDuplicato(s, 'b.jpg', 'photo-x')
    s = segnaErrore(s, 'c.jpg', 'rete assente')
    expect(esitoDelLotto(s)).toBe('concluso-con-errori')
  })

  it('distingue il successo pieno', () => {
    let s = segnaCreata(lotto(), 'a.jpg', 'drafts.1')
    s = segnaCreata(s, 'b.jpg', 'drafts.2')
    s = segnaDuplicato(s, 'c.jpg', 'photo-x')
    expect(esitoDelLotto(s)).toBe('concluso')
  })
})
