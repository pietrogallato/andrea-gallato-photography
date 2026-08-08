import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectSequence } from '../ProjectSequence'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const foto = (id: string, ar = 1.5) => ({
  id,
  ar,
  url: `https://cdn.sanity.io/images/p/d/${id}-3000x2000.jpg`,
  lqip: null,
  alt: `Alt ${id}`,
  altLang: 'it' as const,
})

const photos = [foto('a'), foto('b', 0.75), foto('c')]

beforeAll(() => {
  // jsdom non implementa i metodi di <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

describe('ProjectSequence', () => {
  it('rende ogni fotografia della sequenza', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('rende ogni fotografia come pulsante nativo, apribile da tastiera', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('apre la lightbox sulla fotografia scelta', async () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    await userEvent.click(screen.getAllByRole('button')[1])

    // La lightbox e la stessa della galleria: il nome accessibile porta la
    // posizione, quindi verifica anche che l indice sia quello giusto.
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/2 \/ 3/)
  })

  it('conserva l ordine editoriale della sequenza', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    const alt = screen.getAllByRole('img').map((i) => i.getAttribute('alt'))
    expect(alt).toEqual(['Alt a', 'Alt b', 'Alt c'])
  })

  it('non rende nulla per una sequenza vuota', () => {
    const { container } = render(<ProjectSequence photos={[]} locale="it" dict={dict} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('e navigabile da tastiera', async () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    screen.getAllByRole('button')[0].focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
