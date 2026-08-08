import { describe, it, expect } from 'vitest'
import { galleryPageQuery, galleryCountQuery, homeHeroQuery } from '../queries'
import {
  projectsIndexQuery,
  projectBySlugQuery,
  projectSlugsQuery,
  sitemapQuery,
} from '../queries'

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

describe('query dei progetti', () => {
  it('l indice ordina per anno decrescente, dal piu recente', () => {
    // Il criterio primario e l anno; il titolo serve solo a rendere
    // deterministico l ordine fra progetti dello stesso anno.
    expect(projectsIndexQuery).toContain('order(year desc')
  })

  it('l indice chiede la copertina con i metadati per riservare lo spazio', () => {
    expect(projectsIndexQuery).toContain('cover->')
    expect(projectsIndexQuery).toContain('aspectRatio')
  })

  it('il dettaglio filtra per slug come parametro, non interpolato', () => {
    expect(projectBySlugQuery).toContain('$slug')
    expect(projectBySlugQuery).not.toMatch(/slug\.current\s*==\s*"/)
  })

  it('scarta i riferimenti non risolvibili FILTRANDO PRIMA di dereferenziare', () => {
    // Misurato sul dataset reale: la forma `photos[]->{...}[defined(@)]`, col
    // filtro dopo la proiezione, restituisce un array di null anche quando
    // tutti i riferimenti sono validi, e la pagina si renderizzerebbe vuota.
    // Il filtro va applicato ai riferimenti, non agli oggetti gia proiettati.
    expect(projectBySlugQuery).toContain('photos[defined(@->)]->')
    expect(projectBySlugQuery).not.toContain('}[defined(@)]')
  })

  it('il dettaglio conserva l ordine editoriale delle fotografie', () => {
    // photos[] e un array ordinato: la proiezione non deve riordinarlo.
    expect(projectBySlugQuery).not.toContain('order(orderRank')
  })

  it('gli slug servono a generare le pagine statiche', () => {
    expect(projectSlugsQuery).toContain('slug.current')
  })

  it('la sitemap chiede solo cio che le serve', () => {
    expect(sitemapQuery).toContain('_updatedAt')
    expect(sitemapQuery).toContain('slug.current')
  })
})
