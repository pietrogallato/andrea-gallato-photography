import { describe, it, expect } from 'vitest'
import {
  idBozza,
  riferimentiNonPubblicati,
  riepilogo,
  titoloDellaBozza,
} from '../bozzeMancanti'

describe('riferimentiNonPubblicati', () => {
  it('trova i riferimenti senza documento pubblicato', () => {
    const mancanti = riferimentiNonPubblicati(
      [{ _ref: 'photo-a' }, { _ref: 'photo-b' }],
      ['photo-a'],
    )

    expect(mancanti).toEqual(['photo-b'])
  })

  it('non riporta nulla quando sono tutte pubblicate', () => {
    expect(riferimentiNonPubblicati([{ _ref: 'photo-a' }], ['photo-a', 'photo-z'])).toEqual([])
  })

  /**
   * La copertina e quasi sempre anche dentro la sequenza: nominarla due volte
   * farebbe sembrare che manchino due fotografie invece di una.
   */
  it('nomina una sola volta la fotografia che compare due volte', () => {
    const mancanti = riferimentiNonPubblicati(
      [{ _ref: 'photo-a' }, { _ref: 'photo-a' }, { _ref: 'photo-b' }],
      [],
    )

    expect(mancanti).toEqual(['photo-a', 'photo-b'])
  })

  it('regge buchi nell array senza rompersi', () => {
    // Una voce rimossa dallo Studio puo lasciare un elemento non risolvibile.
    expect(riferimentiNonPubblicati([null, undefined, { _ref: 'photo-a' }], [])).toEqual([
      'photo-a',
    ])
  })

  it('su un progetto senza fotografie non trova nulla', () => {
    expect(riferimentiNonPubblicati([], [])).toEqual([])
  })
})

describe('titoloDellaBozza', () => {
  it('preferisce il titolo italiano', () => {
    expect(
      titoloDellaBozza({ _id: 'drafts.x', titleIt: 'Nebbia', titleEn: 'Fog', altIt: 'alt' }).titolo,
    ).toBe('Nebbia')
  })

  it('ripiega sull inglese quando l italiano manca', () => {
    expect(titoloDellaBozza({ _id: 'drafts.x', titleEn: 'The Wall' }).titolo).toBe('The Wall')
  })

  /**
   * Il titolo e facoltativo, il testo alternativo no: e il ripiego che
   * esiste sempre, e per giunta descrive la fotografia.
   */
  it('ripiega sul testo alternativo quando non c e titolo', () => {
    expect(titoloDellaBozza({ _id: 'drafts.x', altIt: 'Sagoma su un muro ocra' }).titolo).toBe(
      'Sagoma su un muro ocra',
    )
  })

  it('da ultimo usa l id senza il prefisso delle bozze', () => {
    expect(titoloDellaBozza({ _id: 'drafts.photo-the-wall' }).titolo).toBe('photo-the-wall')
  })

  it('non si fa ingannare da un titolo di soli spazi', () => {
    expect(titoloDellaBozza({ _id: 'drafts.x', titleIt: '   ', altIt: 'descrizione' }).titolo).toBe(
      'descrizione',
    )
  })
})

describe('idBozza', () => {
  it('antepone il prefisso delle bozze', () => {
    expect(idBozza('photo-a')).toBe('drafts.photo-a')
  })
})

describe('riepilogo', () => {
  it('distingue nessuna, una e molte', () => {
    expect(riepilogo(0)).toMatch(/Tutte/)
    expect(riepilogo(1)).toMatch(/^Una fotografia/)
    expect(riepilogo(3)).toMatch(/^3 fotografie/)
  })
})
