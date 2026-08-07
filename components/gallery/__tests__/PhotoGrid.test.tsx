import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoGrid } from '../PhotoGrid'
import { packRows, K_DESKTOP } from '@/lib/gallery/packRows'

const photos = [
  { id: 'a', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg', alt: 'Prima', altLang: 'it' as const, lqip: null },
  { id: 'b', ar: 0.75, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', alt: 'Seconda', altLang: 'it' as const, lqip: null },
  { id: 'c', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/c-3000x2000.jpg', alt: 'Terza', altLang: 'it' as const, lqip: null },
]

const rows = packRows(photos, K_DESKTOP)

describe('PhotoGrid', () => {
  it('rende ogni fotografia', () => {
    render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('rende ogni tile come pulsante nativo, non come div cliccabile', () => {
    render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('apre la lightbox sull indice assoluto, non su quello di riga', async () => {
    const onOpen = vi.fn()
    render(<PhotoGrid rows={rows} locale="it" onOpen={onOpen} />)

    await userEvent.click(screen.getAllByRole('button')[2])
    expect(onOpen).toHaveBeenCalledWith(2)
  })

  it('e attivabile da tastiera', async () => {
    const onOpen = vi.fn()
    render(<PhotoGrid rows={rows} locale="it" onOpen={onOpen} />)

    screen.getAllByRole('button')[0].focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith(0)
  })

  it('imposta il rapporto e il fattore di crescita di ogni tile', () => {
    const { container } = render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    const tile = container.querySelector('button') as HTMLElement

    expect(tile.style.getPropertyValue('--ar')).toBe('1.5')
    expect(tile.style.flexGrow).toBe('1.5')
  })

  it('marca l ultima riga cosi il CSS non la giustifica', () => {
    const { container } = render(<PhotoGrid rows={rows} locale="it" onOpen={vi.fn()} />)
    const rowEls = container.querySelectorAll('[data-row]')

    expect(rowEls[rowEls.length - 1].getAttribute('data-last')).toBe('true')
  })
})
