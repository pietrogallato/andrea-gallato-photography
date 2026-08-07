import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox } from '../Lightbox'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const photos = [
  { id: 'a', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg', lqip: null, alt: 'Prima', altLang: 'it' as const, title: 'Nebbia', titleLang: 'it' as const, year: 2024, place: 'Veneto', placeLang: 'it' as const },
  { id: 'b', ar: 0.75, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', lqip: null, alt: 'Seconda', altLang: 'it' as const },
]

beforeAll(() => {
  // jsdom non implementa i metodi di <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function setup(index = 0, onClose = vi.fn(), onNavigate = vi.fn()) {
  render(
    <Lightbox
      photos={photos}
      index={index}
      locale="it"
      dict={dict}
      onClose={onClose}
      onNavigate={onNavigate}
    />,
  )
  return { onClose, onNavigate }
}

describe('Lightbox', () => {
  it('ha sempre un nome accessibile, anche senza titolo', () => {
    setup(1)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName()
  })

  it('usa il titolo come nome accessibile quando c e', () => {
    setup(0)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Nebbia/)
  })

  it('mostra titolo, anno e luogo solo quando valorizzati', () => {
    setup(0)
    expect(screen.getByText('Nebbia')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Veneto')).toBeInTheDocument()
  })

  it('non mostra didascalia quando i campi mancano', () => {
    setup(1)
    expect(screen.queryByText('Nebbia')).toBeNull()
    expect(screen.queryByText('2024')).toBeNull()
  })

  // La chiusura con Esc non e verificabile qui. jsdom non implementa
  // l algoritmo di "request close" di <dialog>: non esiste showModal e non
  // viene mai emesso ne cancel ne close, quindi onClose non puo scattare.
  // Verificato leggendo jsdom/living/nodes/HTMLDialogElement-impl.js.
  // Il comportamento e corretto in un browser vero, dove Esc emette cancel e
  // poi close, ed e coperto dall e2e "si chiude con Esc" del Task 12.

  it('naviga con le frecce', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('non supera l ultima fotografia', async () => {
    const { onNavigate } = setup(1)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('non va prima della prima fotografia', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowLeft}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('annuncia la posizione a ogni navigazione', () => {
    setup(0)
    expect(screen.getByRole('status')).toHaveTextContent('1')
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('espone i pulsanti di chiusura e navigazione, alternativa allo swipe', () => {
    setup(0)
    expect(screen.getByRole('button', { name: dict.lightboxClose })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: dict.lightboxNext })).toBeInTheDocument()
  })

  it('applica la superficie scura indipendentemente dal tema del sito', () => {
    setup(0)
    expect(screen.getByRole('dialog').className).toMatch(/surface-dark/)
  })
})
