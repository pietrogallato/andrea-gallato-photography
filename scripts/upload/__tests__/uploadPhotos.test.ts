import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { slugForFilename } from '../slug'
import { ANDREA_PHOTOS } from '../andreaPhotos'

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
  })
})

describe('ANDREA_PHOTOS', () => {
  it('produce un _id distinto per ogni fotografia', () => {
    const slugs = ANDREA_PHOTOS.map((p) => slugForFilename(p.filename))
    expect(new Set(slugs).size).toBe(ANDREA_PHOTOS.length)
  })

  it('ha un alt italiano descrittivo per ognuna', () => {
    for (const photo of ANDREA_PHOTOS) {
      // Il minimo dello schema e 3 caratteri; un alt utile e ben piu lungo.
      expect(photo.altIt.length, photo.filename).toBeGreaterThan(40)
      expect(photo.altEn.length, photo.filename).toBeGreaterThan(40)
    }
  })

  it('resta dentro i limiti di anno accettati dallo schema', () => {
    for (const photo of ANDREA_PHOTOS) {
      expect(photo.year, photo.filename).toBeGreaterThanOrEqual(1950)
      expect(photo.year, photo.filename).toBeLessThanOrEqual(new Date().getFullYear())
    }
  })
})

/**
 * Un nome di file sbagliato nel manifest fallirebbe a meta caricamento,
 * lasciando il dataset a meta. Meglio accorgersene qui.
 *
 * Il test si salta da solo se la cartella sorgente non c'e: in CI non c'e.
 */
describe('corrispondenza con i file sul disco', () => {
  const sourceDir =
    process.env.PHOTOS_DIR ?? path.join(os.homedir(), 'Downloads', 'Foto sito Andrea')

  let onDisk: string[] | null = null
  try {
    onDisk = readdirSync(sourceDir).filter((f) => /\.(jpe?g|png)$/i.test(f))
  } catch {
    onDisk = null
  }

  it.skipIf(onDisk === null)('ogni voce del manifest esiste come file', () => {
    for (const photo of ANDREA_PHOTOS) {
      expect(onDisk, photo.filename).toContain(photo.filename)
    }
  })

  it.skipIf(onDisk === null)('nessun file della cartella resta fuori dal manifest', () => {
    const listed = new Set(ANDREA_PHOTOS.map((p) => p.filename))
    expect(onDisk!.filter((f) => !listed.has(f))).toEqual([])
  })
})
