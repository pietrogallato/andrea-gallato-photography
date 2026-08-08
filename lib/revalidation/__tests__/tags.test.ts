import { describe, it, expect } from 'vitest'
import { directTagsFor } from '../tags'

describe('directTagsFor', () => {
  it('una fotografia invalida la galleria', () => {
    expect(directTagsFor({ _type: 'photo', _id: 'p1', operation: 'update' })).toContain('gallery')
  })

  it('un progetto invalida se stesso e l indice', () => {
    const t = directTagsFor({ _type: 'project', _id: 'x', slug: 'nebbia', operation: 'update' })
    expect(t).toContain('project:nebbia')
    expect(t).toContain('projects-index')
  })

  it('un cambio di slug invalida vecchio e nuovo percorso', () => {
    // Senza il vecchio tag la pagina al vecchio indirizzo resterebbe servita
    // dalla cache a tempo indeterminato: con i tag la scadenza a tempo e
    // disattivata e nessun altro evento interverrebbe.
    const t = directTagsFor({
      _type: 'project', _id: 'x', slug: 'nebbia-2024', previousSlug: 'nebbia', operation: 'update',
    })
    expect(t).toContain('project:nebbia-2024')
    expect(t).toContain('project:nebbia')
  })

  it('non duplica il tag quando lo slug non e cambiato', () => {
    const t = directTagsFor({
      _type: 'project', _id: 'x', slug: 'nebbia', previousSlug: 'nebbia', operation: 'update',
    })
    expect(t.filter((x) => x === 'project:nebbia')).toHaveLength(1)
  })

  it('la homepage invalida se stessa', () => {
    expect(directTagsFor({ _type: 'homePage', _id: 'homePage', operation: 'update' })).toContain('home')
  })

  it('About invalida se stessa', () => {
    expect(directTagsFor({ _type: 'aboutPage', _id: 'aboutPage', operation: 'update' })).toContain('about')
  })

  it('le impostazioni invalidano tutto, perche compaiono su ogni pagina', () => {
    const t = directTagsFor({ _type: 'siteSettings', _id: 'siteSettings', operation: 'update' })
    for (const atteso of ['settings', 'home', 'gallery', 'projects-index', 'about', 'sitemap']) {
      expect(t).toContain(atteso)
    }
  })

  it('include la sitemap per cio che vi compare', () => {
    expect(directTagsFor({ _type: 'project', _id: 'x', slug: 's', operation: 'create' })).toContain('sitemap')
  })

  it('e idempotente: nessun tag ripetuto', () => {
    const t = directTagsFor({ _type: 'siteSettings', _id: 'siteSettings', operation: 'update' })
    expect(new Set(t).size).toBe(t.length)
  })

  it('vale per creazione, aggiornamento ed eliminazione allo stesso modo', () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(directTagsFor({ _type: 'project', _id: 'x', slug: 's', operation })).toContain('projects-index')
    }
  })

  it('regge un progetto senza slug senza produrre un tag malformato', () => {
    const t = directTagsFor({ _type: 'project', _id: 'x', operation: 'delete' })
    expect(t).toContain('projects-index')
    expect(t.some((x) => x.startsWith('project:'))).toBe(false)
  })

  it('ignora i tipi sconosciuti senza lanciare', () => {
    expect(directTagsFor({ _type: 'qualcosa', _id: 'x', operation: 'update' })).toEqual([])
  })
})
