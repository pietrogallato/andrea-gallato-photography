import { describe, it, expect } from 'vitest'
import { toGalleryPhoto } from '../toGalleryPhoto'

const raw = {
  _id: 'p1',
  altIt: 'Nebbia',
  altEn: 'Fog',
  titleIt: 'Studio 1',
  titleEn: null,
  placeIt: 'Veneto',
  placeEn: null,
  year: 2024,
  url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
  aspectRatio: 1.5,
  lqip: 'data:image/jpeg;base64,x',
}

describe('toGalleryPhoto', () => {
  it('sceglie l alt nella lingua della pagina', () => {
    expect(toGalleryPhoto(raw, 'en').alt).toBe('Fog')
    expect(toGalleryPhoto(raw, 'it').alt).toBe('Nebbia')
  })

  it('dichiara la lingua dell alt quando ricade sull italiano', () => {
    const photo = toGalleryPhoto({ ...raw, altEn: null }, 'en')
    expect(photo.alt).toBe('Nebbia')
    expect(photo.altLang).toBe('it')
  })

  it('dichiara la lingua del titolo quando ricade sull italiano', () => {
    const photo = toGalleryPhoto(raw, 'en')
    expect(photo.title).toBe('Studio 1')
    expect(photo.titleLang).toBe('it')
  })

  it('omette titolo, luogo e anno quando non sono valorizzati', () => {
    const photo = toGalleryPhoto(
      { ...raw, titleIt: null, titleEn: null, placeIt: null, placeEn: null, year: null },
      'it',
    )
    expect(photo.title).toBeUndefined()
    expect(photo.place).toBeUndefined()
    expect(photo.year).toBeUndefined()
  })

  it('ricade su un rapporto quadrato se il metadato manca', () => {
    expect(toGalleryPhoto({ ...raw, aspectRatio: null }, 'it').ar).toBe(1)
  })
})
