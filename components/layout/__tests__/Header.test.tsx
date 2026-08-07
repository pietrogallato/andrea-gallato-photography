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

  it('contiene il selettore lingua e l interruttore tema', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('navigation', { name: 'Lingua' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tema chiaro' })).toBeInTheDocument()
  })

  it('non linka Progetti e About in questa fase', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.queryByRole('link', { name: 'Progetti' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull()
  })
})
