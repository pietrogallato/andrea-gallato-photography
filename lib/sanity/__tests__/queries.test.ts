import { describe, it, expect } from 'vitest'
import { galleryPageQuery, galleryCountQuery, homeHeroQuery } from '../queries'

describe('query della galleria', () => {
  it('filtra su showInGallery, cosi le foto escluse restano usabili nei progetti', () => {
    expect(galleryPageQuery).toContain('showInGallery == true')
  })

  it('ordina per orderRank, che e l ordinamento editoriale manuale', () => {
    expect(galleryPageQuery).toContain('orderRank')
  })

  it('pagina con parametri e non con valori interpolati', () => {
    expect(galleryPageQuery).toContain('$start')
    expect(galleryPageQuery).toContain('$end')
  })

  it('chiede il rapporto d aspetto, necessario a riservare lo spazio', () => {
    expect(galleryPageQuery).toContain('aspectRatio')
  })

  it('chiede il LQIP per il placeholder di caricamento', () => {
    expect(galleryPageQuery).toContain('lqip')
  })

  it('conta con lo stesso filtro della pagina, altrimenti hasMore mente', () => {
    expect(galleryCountQuery).toContain('showInGallery == true')
  })

  it('la hero chiede la fotografia protagonista della homepage', () => {
    expect(homeHeroQuery).toContain('heroPhoto')
  })
})
