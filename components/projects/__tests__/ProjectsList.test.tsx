import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectsList } from '../ProjectsList'

const progetti = [
  {
    id: 'a',
    slug: 'nebbia',
    title: 'Nebbia',
    titleLang: 'it' as const,
    year: 2023,
    cover: {
      id: 'p1', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
      lqip: null, alt: 'Copertina', altLang: 'it' as const,
    },
  },
  { id: 'b', slug: 'citta', title: 'City', titleLang: 'en' as const, cover: null },
]

describe('ProjectsList', () => {
  it('rende un collegamento per progetto, con lo slug localizzato', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByRole('link', { name: /Nebbia/ })).toHaveAttribute('href', '/it/progetti/nebbia')
  })

  it('usa il segmento inglese in inglese, conservando lo slug', () => {
    render(<ProjectsList projects={progetti} locale="en" />)
    expect(screen.getByRole('link', { name: /Nebbia/ })).toHaveAttribute('href', '/en/projects/nebbia')
  })

  it('mostra l anno solo quando c e', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.queryByText('undefined')).toBeNull()
  })

  it('marca la lingua del titolo quando differisce dalla pagina', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByText('City')).toHaveAttribute('lang', 'en')
  })

  it('non marca la lingua quando coincide', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByText('Nebbia')).not.toHaveAttribute('lang')
  })

  it('regge un progetto senza copertina senza rompersi', () => {
    // La copertina e obbligatoria a schema, ma un riferimento appeso la
    // azzera: la specifica di prodotto 12 chiede di omettere l elemento,
    // non di rompere la pagina.
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByRole('link', { name: /City/ })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})
