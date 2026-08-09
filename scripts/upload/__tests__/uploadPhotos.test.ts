import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { slugForFilename } from '../slug'
import { photoIdFor, type PhotoSpec } from '../photoDoc'
import { ANDREA_PHOTOS } from '../andreaPhotos'
import {
  CONCORSO_TRIESTE_DIR,
  CONCORSO_TRIESTE_PHOTOS,
  CONCORSO_TRIESTE_PROJECT,
} from '../concorsoTrieste'

describe('slugForFilename', () => {
  it('normalizza spazi, maiuscole e punteggiatura', () => {
    expect(slugForFilename('The Wall.jpg')).toBe('the-wall')
    expect(slugForFilename('Wedding Day, Ordinary Street.jpg')).toBe(
      'wedding-day-ordinary-street',
    )
    expect(slugForFilename('DSC_0098-4.jpg')).toBe('dsc-0098-4')
    expect(slugForFilename('same wall 1.png')).toBe('same-wall-1')
  })

  it('non lascia trattini in testa o in coda', () => {
    expect(slugForFilename('  spazi  .jpg')).toBe('spazi')
    expect(slugForFilename('!strano!.png')).toBe('strano')
    // Il nome ha davvero uno spazio prima dell estensione.
    expect(slugForFilename('Reflections of a Market .jpg')).toBe('reflections-of-a-market')
  })

  it('ignora maiuscole e minuscole nell estensione', () => {
    expect(slugForFilename('Under Her Gaze.JPG')).toBe('under-her-gaze')
  })
})

const LOTTI: Array<{ nome: string; dir: string; photos: PhotoSpec[] }> = [
  {
    nome: 'galleria',
    dir: process.env.PHOTOS_DIR ?? path.join(os.homedir(), 'Downloads', 'Foto sito Andrea'),
    photos: ANDREA_PHOTOS,
  },
  { nome: 'concorso Trieste', dir: CONCORSO_TRIESTE_DIR, photos: CONCORSO_TRIESTE_PHOTOS },
]

describe.each(LOTTI)('lotto $nome', ({ dir, photos }) => {
  it('produce un _id distinto per ogni fotografia', () => {
    const ids = photos.map((p) => photoIdFor(p.filename))
    expect(new Set(ids).size).toBe(photos.length)
  })

  it('ha un alt italiano e inglese descrittivi per ognuna', () => {
    for (const photo of photos) {
      // Il minimo dello schema e 3 caratteri; un alt utile e ben piu lungo.
      expect(photo.altIt.length, photo.filename).toBeGreaterThan(40)
      expect(photo.altEn.length, photo.filename).toBeGreaterThan(40)
    }
  })

  it('resta dentro i limiti di anno accettati dallo schema', () => {
    for (const photo of photos) {
      expect(photo.year, photo.filename).toBeGreaterThanOrEqual(1950)
      expect(photo.year, photo.filename).toBeLessThanOrEqual(new Date().getFullYear())
    }
  })

  /**
   * Un nome di file sbagliato nel manifest fallirebbe a meta caricamento,
   * lasciando il dataset a meta. Meglio accorgersene qui.
   *
   * I test si saltano da soli se la cartella sorgente non c'e: in CI non c'e.
   */
  describe('corrispondenza con i file sul disco', () => {
    let onDisk: string[] | null = null
    try {
      onDisk = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f))
    } catch {
      onDisk = null
    }

    it.skipIf(onDisk === null)('ogni voce del manifest esiste come file', () => {
      for (const photo of photos) {
        expect(onDisk, photo.filename).toContain(photo.filename)
      }
    })

    it.skipIf(onDisk === null)('nessun file della cartella resta fuori dal manifest', () => {
      const listed = new Set(photos.map((p) => p.filename))
      expect(onDisk!.filter((f) => !listed.has(f))).toEqual([])
    })
  })
})

describe('progetto Concorso Trieste', () => {
  it('la copertina e una delle sue fotografie', () => {
    const ids = CONCORSO_TRIESTE_PHOTOS.map((p) => photoIdFor(p.filename))
    expect(ids).toContain(photoIdFor(CONCORSO_TRIESTE_PROJECT.coverFilename))
  })

  it('ha almeno una fotografia, come pretende lo schema', () => {
    expect(CONCORSO_TRIESTE_PHOTOS.length).toBeGreaterThanOrEqual(1)
  })

  it('lo slug e minuscolo e senza spazi: finisce nell URL', () => {
    expect(CONCORSO_TRIESTE_PROJECT.slug).toMatch(/^[a-z0-9-]+$/)
  })
})

/**
 * La garanzia che tiene insieme i due lotti: «Wedding Day, Ordinary Street» e
 * lo stesso scatto in entrambi, e deve risolvere allo stesso documento. Se
 * questo test cade, il progetto sta creando un doppione della fotografia
 * invece di riusare quella gia in galleria.
 */
describe('fotografie condivise fra lotti', () => {
  it('lo stesso nome di file da lo stesso _id in lotti diversi', () => {
    const condivise = CONCORSO_TRIESTE_PHOTOS.filter((p) =>
      ANDREA_PHOTOS.some((g) => g.filename === p.filename),
    )

    expect(condivise.map((p) => p.filename)).toEqual(['Wedding Day, Ordinary Street.jpg'])

    for (const p of condivise) {
      const inGalleria = ANDREA_PHOTOS.find((g) => g.filename === p.filename)!
      expect(photoIdFor(p.filename)).toBe(photoIdFor(inGalleria.filename))
      // Stesso scatto, stessa descrizione: divergere qui vorrebbe dire che una
      // delle due e sbagliata, e il documento ne conserverebbe una sola.
      expect(p.altIt).toBe(inGalleria.altIt)
    }
  })
})
