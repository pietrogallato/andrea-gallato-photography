import { describe, it, expect } from 'vitest'
import { buildSitemapEntries } from '../sitemapEntries'

const dati = {
  siteUrl: 'https://esempio.it',
  projects: [{ slug: 'nebbia', _updatedAt: '2026-08-01T10:00:00Z' }],
  fallbackDate: '2026-08-05T10:00:00Z',
}

describe('buildSitemapEntries', () => {
  it('elenca ogni pagina pubblica in entrambe le lingue', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)

    for (const atteso of [
      'https://esempio.it/it', 'https://esempio.it/en',
      'https://esempio.it/it/fotografie', 'https://esempio.it/en/photographs',
      'https://esempio.it/it/progetti', 'https://esempio.it/en/projects',
      'https://esempio.it/it/about', 'https://esempio.it/en/about',
    ]) {
      expect(url).toContain(atteso)
    }
  })

  it('include le pagine di progetto in entrambe le lingue', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)
    expect(url).toContain('https://esempio.it/it/progetti/nebbia')
    expect(url).toContain('https://esempio.it/en/projects/nebbia')
  })

  it('dichiara le lingue alternative di ogni voce', () => {
    const home = buildSitemapEntries(dati).find((e) => e.url === 'https://esempio.it/it')
    expect(home?.alternates?.languages).toEqual({
      it: 'https://esempio.it/it',
      en: 'https://esempio.it/en',
    })
  })

  it('usa la data di modifica del progetto, non quella di ripiego', () => {
    const p = buildSitemapEntries(dati).find((e) => e.url.endsWith('/progetti/nebbia'))
    expect(p?.lastModified).toEqual(new Date('2026-08-01T10:00:00Z'))
  })

  it('usa la data di ripiego per le pagine senza data propria', () => {
    const home = buildSitemapEntries(dati).find((e) => e.url === 'https://esempio.it/it')
    expect(home?.lastModified).toEqual(new Date('2026-08-05T10:00:00Z'))
  })

  it('non produce mai URL doppie', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)
    expect(new Set(url).size).toBe(url.length)
  })

  it('regge l assenza di progetti', () => {
    expect(buildSitemapEntries({ ...dati, projects: [] }).length).toBe(8)
  })

  it('scarta i progetti senza slug', () => {
    // Un progetto senza slug non ha una pagina: metterlo in sitemap
    // dichiarerebbe ai motori un URL che restituisce 404.
    const con = buildSitemapEntries({
      ...dati,
      projects: [{ slug: null, _updatedAt: null }, { slug: 'ok', _updatedAt: null }],
    })
    expect(con.filter((e) => e.url.includes('/progetti/')).length).toBe(1)
  })
})
