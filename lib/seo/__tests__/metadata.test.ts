import { describe, it, expect } from 'vitest'
import { buildPageMetadata } from '../metadata'

const base = {
  siteUrl: 'https://esempio.it',
  siteName: 'Andrea Gallato',
  socialImageUrl: 'https://cdn.sanity.io/images/p/d/s-2000x1000.jpg',
}

describe('buildPageMetadata', () => {
  it('dichiara il canonical sul percorso pubblico localizzato', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'gallery' }, title: 'Fotografie' })
    expect(m.alternates?.canonical).toBe('https://esempio.it/it/fotografie')
  })

  it('dichiara entrambe le lingue in hreflang, con i segmenti tradotti', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'gallery' }, title: 'Fotografie' })
    expect(m.alternates?.languages).toEqual({
      it: 'https://esempio.it/it/fotografie',
      en: 'https://esempio.it/en/photographs',
    })
  })

  it('conserva lo slug di progetto in entrambe le lingue', () => {
    const m = buildPageMetadata({
      ...base, locale: 'en', route: { key: 'project', slug: 'nebbia' }, title: 'Fog',
    })
    expect(m.alternates?.languages).toEqual({
      it: 'https://esempio.it/it/progetti/nebbia',
      en: 'https://esempio.it/en/projects/nebbia',
    })
  })

  it('fissa il formato dell immagine social invece di negoziarlo', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'Andrea Gallato' })
    const url = String((m.openGraph?.images as { url: string }[])[0].url)

    // auto=format dipende dall header Accept, che gli scraper social non
    // mandano in modo affidabile: l anteprima arriverebbe in un formato che
    // non sanno rendere, o non arriverebbe affatto.
    expect(url).toContain('fm=jpg')
    expect(url).not.toContain('auto=format')
  })

  it('dichiara la lingua del documento in Open Graph', () => {
    const it = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'x' })
    const en = buildPageMetadata({ ...base, locale: 'en', route: { key: 'home' }, title: 'x' })
    expect(it.openGraph?.locale).toBe('it_IT')
    expect(en.openGraph?.locale).toBe('en_US')
  })

  it('omette l immagine social quando non e configurata', () => {
    const m = buildPageMetadata({
      ...base, socialImageUrl: null, locale: 'it', route: { key: 'home' }, title: 'x',
    })
    expect(m.openGraph?.images).toBeUndefined()

    // TwitterMetadata e un unione: senza restringerla `card` non e accessibile.
    expect((m.twitter as { card?: string } | undefined)?.card).toBe('summary')
  })

  it('usa la descrizione solo se valorizzata', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'x', description: '  ' })
    expect(m.description).toBeUndefined()
  })

  it('non raddoppia la barra fra dominio e percorso', () => {
    const m = buildPageMetadata({
      ...base, siteUrl: 'https://esempio.it', locale: 'it', route: { key: 'home' }, title: 'x',
    })
    expect(m.alternates?.canonical).toBe('https://esempio.it/it')
  })
})
