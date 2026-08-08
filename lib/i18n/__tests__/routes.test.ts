import { describe, it, expect } from 'vitest'
import { resolveRoute, pathFor, alternatePaths, alternatePathsForPathname } from '../routes'

describe('resolveRoute', () => {
  it('risolve la homepage con segmenti vuoti', () => {
    expect(resolveRoute('it', [])).toEqual({ key: 'home' })
    expect(resolveRoute('en', [])).toEqual({ key: 'home' })
  })

  it('risolve i segmenti tradotti nella lingua corretta', () => {
    expect(resolveRoute('it', ['fotografie'])).toEqual({ key: 'gallery' })
    expect(resolveRoute('en', ['photographs'])).toEqual({ key: 'gallery' })
    expect(resolveRoute('it', ['progetti'])).toEqual({ key: 'projects' })
    expect(resolveRoute('en', ['projects'])).toEqual({ key: 'projects' })
    expect(resolveRoute('it', ['about'])).toEqual({ key: 'about' })
  })

  it('rifiuta il segmento della lingua sbagliata', () => {
    expect(resolveRoute('it', ['photographs'])).toBeNull()
    expect(resolveRoute('en', ['fotografie'])).toBeNull()
  })

  it('rifiuta il nome canonico interno', () => {
    expect(resolveRoute('it', ['gallery'])).toBeNull()
    expect(resolveRoute('en', ['gallery'])).toBeNull()
  })

  it('risolve una pagina di progetto con lo slug', () => {
    expect(resolveRoute('it', ['progetti', 'nebbia'])).toEqual({ key: 'project', slug: 'nebbia' })
    expect(resolveRoute('en', ['projects', 'nebbia'])).toEqual({ key: 'project', slug: 'nebbia' })
  })

  it('rifiuta percorsi sconosciuti e troppo profondi', () => {
    expect(resolveRoute('it', ['qualunque-cosa'])).toBeNull()
    expect(resolveRoute('it', ['fotografie', 'extra'])).toBeNull()
    expect(resolveRoute('it', ['progetti', 'nebbia', 'extra'])).toBeNull()
  })

  it('rifiuta uno slug di progetto vuoto', () => {
    expect(resolveRoute('it', ['progetti', ''])).toBeNull()
  })
})

describe('pathFor', () => {
  it('costruisce il percorso pubblico localizzato', () => {
    expect(pathFor('it', { key: 'home' })).toBe('/it')
    expect(pathFor('en', { key: 'home' })).toBe('/en')
    expect(pathFor('it', { key: 'gallery' })).toBe('/it/fotografie')
    expect(pathFor('en', { key: 'gallery' })).toBe('/en/photographs')
    expect(pathFor('it', { key: 'project', slug: 'nebbia' })).toBe('/it/progetti/nebbia')
    expect(pathFor('en', { key: 'project', slug: 'nebbia' })).toBe('/en/projects/nebbia')
  })
})

describe('alternatePaths', () => {
  it('produce il percorso equivalente in entrambe le lingue', () => {
    expect(alternatePaths({ key: 'gallery' })).toEqual({
      it: '/it/fotografie',
      en: '/en/photographs',
    })
  })

  it('mantiene lo stesso slug di progetto nelle due lingue', () => {
    expect(alternatePaths({ key: 'project', slug: 'nebbia' })).toEqual({
      it: '/it/progetti/nebbia',
      en: '/en/projects/nebbia',
    })
  })
})

describe('alternatePathsForPathname', () => {
  it('resta sulla stessa pagina invece di riportare alla home', () => {
    expect(alternatePathsForPathname('/it/about')).toEqual({ it: '/it/about', en: '/en/about' })
  })

  it('traduce il segmento quando le due lingue lo scrivono diverso', () => {
    expect(alternatePathsForPathname('/it/fotografie')).toEqual({
      it: '/it/fotografie',
      en: '/en/photographs',
    })
    expect(alternatePathsForPathname('/en/photographs')).toEqual({
      it: '/it/fotografie',
      en: '/en/photographs',
    })
  })

  it('conserva lo slug di progetto', () => {
    expect(alternatePathsForPathname('/it/progetti/nebbia')).toEqual({
      it: '/it/progetti/nebbia',
      en: '/en/projects/nebbia',
    })
  })

  it('gestisce la home e la barra finale', () => {
    expect(alternatePathsForPathname('/it')).toEqual({ it: '/it', en: '/en' })
    expect(alternatePathsForPathname('/it/')).toEqual({ it: '/it', en: '/en' })
  })

  it('ricade sulla home quando il percorso non risolve', () => {
    // Lingua non supportata, nome canonico interno, radice: in tutti e tre i
    // casi il selettore deve comunque portare da qualche parte di valido.
    expect(alternatePathsForPathname('/fr/qualcosa')).toEqual({ it: '/it', en: '/en' })
    expect(alternatePathsForPathname('/it/gallery')).toEqual({ it: '/it', en: '/en' })
    expect(alternatePathsForPathname('/')).toEqual({ it: '/it', en: '/en' })
  })
})
