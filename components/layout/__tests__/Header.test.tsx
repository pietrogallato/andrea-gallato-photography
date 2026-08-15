import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'

describe('Header', () => {
  it('espone un landmark di navigazione', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('mostra il nome del fotografo come link alla home localizzata', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Andrea Gallato' })).toHaveAttribute('href', '/it')
  })

  it('linka la galleria con il segmento della lingua corrente', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Fotografie' })).toHaveAttribute('href', '/it/fotografie')
  })

  it('usa i segmenti inglesi in inglese', () => {
    render(<Header locale="en" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Photographs' })).toHaveAttribute('href', '/en/photographs')
    expect(screen.getByRole('link', { name: 'Andrea Gallato' })).toHaveAttribute('href', '/en')
  })

  it('contiene il selettore lingua', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('navigation', { name: 'Lingua' })).toBeInTheDocument()
  })

  it('linka Fotografie, Progetti e About', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Fotografie' })).toHaveAttribute('href', '/it/fotografie')
    expect(screen.getByRole('link', { name: 'Progetti' })).toHaveAttribute('href', '/it/progetti')
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/it/about')
  })

  it('usa i segmenti inglesi in inglese', () => {
    render(<Header locale="en" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/en/projects')
  })
})
