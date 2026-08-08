import { describe, it, expect } from 'vitest'
import { toProjectSummary, toProjectDetail } from '../toProject'

const foto = {
  _id: 'p1',
  altIt: 'Nebbia sul fiume',
  altEn: 'Fog over the river',
  titleIt: 'Studio 1',
  titleEn: null,
  placeIt: 'Veneto',
  placeEn: null,
  year: 2023,
  url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
  aspectRatio: 1.5,
  lqip: 'data:image/jpeg;base64,x',
}

const raw = {
  _id: 'proj1',
  titleIt: 'Nebbia',
  titleEn: 'Fog',
  descriptionIt: 'Descrizione italiana',
  descriptionEn: null,
  year: 2023,
  slug: 'nebbia',
  cover: foto,
  photos: [foto, { ...foto, _id: 'p2' }],
}

describe('toProjectSummary', () => {
  it('sceglie il titolo nella lingua della pagina', () => {
    expect(toProjectSummary(raw, 'en').title).toBe('Fog')
    expect(toProjectSummary(raw, 'it').title).toBe('Nebbia')
  })

  it('dichiara la lingua quando il titolo ricade sull italiano', () => {
    const s = toProjectSummary({ ...raw, titleEn: null }, 'en')
    expect(s.title).toBe('Nebbia')
    expect(s.titleLang).toBe('it')
  })

  it('omette l anno quando non e valorizzato', () => {
    expect(toProjectSummary({ ...raw, year: null }, 'it').year).toBeUndefined()
  })

  it('regge un progetto senza copertina', () => {
    expect(toProjectSummary({ ...raw, cover: null }, 'it').cover).toBeNull()
  })
})

describe('toProjectDetail', () => {
  it('dichiara la lingua quando la descrizione ricade sull italiano', () => {
    const d = toProjectDetail(raw, 'en')!
    expect(d.description).toBe('Descrizione italiana')
    expect(d.descriptionLang).toBe('it')
  })

  it('conserva l ordine editoriale delle fotografie', () => {
    // La sequenza e quella scelta dall editor nell array photos, non
    // l ordinamento globale della galleria.
    expect(toProjectDetail(raw, 'it')!.photos.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('sopravvive a un progetto senza fotografie', () => {
    // Lo schema ne richiede almeno una, ma un riferimento appeso puo
    // svuotare l array dopo il filtro sui riferimenti.
    expect(toProjectDetail({ ...raw, photos: null }, 'it')!.photos).toEqual([])
  })

  it('restituisce null per un progetto inesistente', () => {
    expect(toProjectDetail(null, 'it')).toBeNull()
    expect(toProjectDetail(undefined, 'it')).toBeNull()
  })
})
