import { describe, it, expect } from 'vitest'
import { inAnteprima, risolviDestinazione } from '../destinazione'

describe('inAnteprima', () => {
  it('infila il segmento dopo la lingua', () => {
    expect(inAnteprima('/it/fotografie')).toBe('/it/preview/fotografie')
    expect(inAnteprima('/en/projects/concorso-trieste')).toBe(
      '/en/preview/projects/concorso-trieste',
    )
  })

  it('vale anche per la home, che non ha altri segmenti', () => {
    expect(inAnteprima('/it')).toBe('/it/preview')
  })

  it('lascia il percorso dentro il sito', () => {
    for (const p of ['/it', '/en/about', '/it/progetti']) {
      const a = inAnteprima(p)
      expect(a.startsWith('/')).toBe(true)
      expect(a.startsWith('//')).toBe(false)
    }
  })
})

describe('risolviDestinazione', () => {
  it('manda alla pagina chiesta nella lingua chiesta', () => {
    expect(risolviDestinazione({ locale: 'en', tipo: 'gallery' })).toBe('/en/photographs')
    expect(risolviDestinazione({ locale: 'it', tipo: 'about' })).toBe('/it/about')
  })

  it('costruisce il percorso di un progetto dallo slug', () => {
    expect(risolviDestinazione({ locale: 'it', tipo: 'project', slug: 'concorso-trieste' })).toBe(
      '/it/progetti/concorso-trieste',
    )
  })

  it('ripiega sull italiano quando la lingua manca o non esiste', () => {
    expect(risolviDestinazione({ tipo: 'gallery' })).toBe('/it/fotografie')
    expect(risolviDestinazione({ locale: 'fr', tipo: 'gallery' })).toBe('/it/fotografie')
  })

  it('ripiega sulla home quando il tipo non e riconosciuto', () => {
    expect(risolviDestinazione({ locale: 'it', tipo: 'chissa' })).toBe('/it')
    expect(risolviDestinazione({})).toBe('/it')
  })

  it('manda all indice dei progetti quando lo slug manca', () => {
    expect(risolviDestinazione({ locale: 'it', tipo: 'project' })).toBe('/it/progetti')
  })

  /**
   * Il cuore della faccenda. Se il percorso arrivasse dalla richiesta,
   * chiunque inoltri un link di anteprima potrebbe costruire un URL sul
   * dominio del sito che porta altrove — e il dominio del sito e proprio cio
   * che lo fa sembrare affidabile.
   */
  describe('non si fa portare fuori dal sito', () => {
    const tentativi = [
      'https://esempio.invalido',
      '//esempio.invalido',
      '/../../etc/passwd',
      'javascript:alert(1)',
      'concorso-trieste/../../../admin',
      'concorso trieste',
      'CONCORSO-TRIESTE',
      'slug%2F..%2F..',
      '',
    ]

    for (const slug of tentativi) {
      it(`rifiuta lo slug ${JSON.stringify(slug)}`, () => {
        const destinazione = risolviDestinazione({ locale: 'it', tipo: 'project', slug })

        // Sempre un percorso interno, mai assoluto e mai con risalite.
        expect(destinazione.startsWith('/')).toBe(true)
        expect(destinazione.startsWith('//')).toBe(false)
        expect(destinazione).not.toContain('..')
        expect(destinazione).not.toContain(':')
        expect(destinazione).toBe('/it/progetti')
      })
    }

    it('non si fa portare fuori nemmeno dalla lingua', () => {
      const destinazione = risolviDestinazione({ locale: '//esempio.invalido', tipo: 'home' })
      expect(destinazione).toBe('/it')
    })

    it('rifiuta uno slug piu lungo del limite dello schema', () => {
      expect(risolviDestinazione({ tipo: 'project', slug: 'a'.repeat(200) })).toBe('/it/progetti')
    })
  })

  it('accetta uno slug legittimo con piu trattini', () => {
    expect(risolviDestinazione({ tipo: 'project', slug: 'nebbia-sul-sile-2024' })).toBe(
      '/it/progetti/nebbia-sul-sile-2024',
    )
  })
})
