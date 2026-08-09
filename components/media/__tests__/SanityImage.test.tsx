import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SanityImage } from '../SanityImage'

const photo = {
  url: 'https://cdn.sanity.io/images/xpdypayk/development/abc-4000x3000.jpg',
  aspectRatio: 4 / 3,
  lqip: 'data:image/jpeg;base64,/9j/placeholder',
  alt: 'Nebbia sul fiume',
  altLang: 'it' as const,
}

describe('SanityImage', () => {
  it('espone l alt text come nome accessibile', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img', { name: 'Nebbia sul fiume' })).toBeInTheDocument()
  })

  it('marca la lingua quando l alt viene dal fallback italiano', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="en" />)
    expect(screen.getByRole('img')).toHaveAttribute('lang', 'it')
  })

  it('non marca la lingua quando coincide con quella della pagina', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img')).not.toHaveAttribute('lang')
  })

  it('riserva lo spazio con aspect-ratio prima del caricamento', () => {
    const { container } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--ar')).toBe(String(4 / 3))
  })

  it('carica in lazy per impostazione predefinita', () => {
    render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })

  it('accetta la priorita esplicita per l unica immagine protagonista', () => {
    render(<SanityImage photo={photo} sizes="100vw" locale="it" priority />)
    expect(screen.getByRole('img')).not.toHaveAttribute('loading', 'lazy')
  })

  it('mostra un riquadro neutro con l alt se l immagine fallisce, senza perdere le dimensioni', () => {
    const { container } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    fireEvent.error(screen.getByRole('img'))

    expect(screen.getByText('Nebbia sul fiume')).toBeInTheDocument()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--ar')).toBe(String(4 / 3))
  })

  /**
   * Lo stato di errore vive nel componente, ma la fotografia arriva dalle
   * prop: nella lightbox lo stesso componente ne mostra molte, una dopo
   * l altra. Tenendo un booleano, una fotografia rotta lasciava acceso il
   * ripiego anche su tutte le successive, che erano sane.
   */
  it('torna a mostrare l immagine quando cambia fotografia dopo un errore', () => {
    const altra = { ...photo, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', alt: 'Altra' }

    const { rerender } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).toBeNull()

    rerender(<SanityImage photo={altra} sizes="50vw" locale="it" />)

    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.queryByText('Nebbia sul fiume')).toBeNull()
  })

  /**
   * Il difetto originale: React riusava lo stesso <img> cambiandogli `src`, e
   * il browser continuava a dipingere la fotografia precedente finche la
   * nuova non era decodificata. jsdom non dipinge, quindi qui si verifica il
   * rimedio — il nodo viene sostituito — non il sintomo.
   */
  it('rimonta l elemento invece di riscrivere src quando cambia fotografia', () => {
    const altra = { ...photo, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', alt: 'Altra' }

    const { rerender } = render(<SanityImage photo={photo} sizes="50vw" locale="it" />)
    const primo = screen.getByRole('img')

    rerender(<SanityImage photo={altra} sizes="50vw" locale="it" />)

    expect(screen.getByRole('img')).not.toBe(primo)
    expect(primo).not.toBeInTheDocument()
  })
})
