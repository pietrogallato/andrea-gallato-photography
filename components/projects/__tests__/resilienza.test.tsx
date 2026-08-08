import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectsList } from '../ProjectsList'
import { ProjectSequence } from '../ProjectSequence'
import { toProjectDetail, toProjectSummary } from '@/lib/projects/toProject'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

/**
 * Specifica di prodotto 12: un riferimento non piu disponibile fa omettere
 * l elemento, non rompere la pagina. Questi test partono da documenti Sanity
 * degradati e verificano che la catena mapping piu componente regga.
 */
describe('stati degradati dei progetti', () => {
  it('progetto senza copertina: la voce resta, l immagine no', () => {
    const p = toProjectSummary(
      { _id: 'x', titleIt: 'Senza copertina', slug: 'x', cover: null },
      'it',
    )
    render(<ProjectsList projects={[p]} locale="it" />)

    expect(screen.getByRole('link', { name: /Senza copertina/ })).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('progetto senza anno: non compare "undefined"', () => {
    const p = toProjectSummary({ _id: 'x', titleIt: 'Senza anno', slug: 'x', year: null }, 'it')
    const { container } = render(<ProjectsList projects={[p]} locale="it" />)

    expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('null')
  })

  it('progetto senza titolo in nessuna lingua: il collegamento resta raggiungibile', () => {
    const p = toProjectSummary({ _id: 'x', titleIt: null, titleEn: null, slug: 'x' }, 'it')
    render(<ProjectsList projects={[p]} locale="it" />)

    // Il titolo e vuoto ma il collegamento esiste: meglio una voce muta che
    // una pagina rotta o un progetto irraggiungibile.
    expect(screen.getByRole('link')).toHaveAttribute('href', '/it/progetti/x')
  })

  it('progetto con fotografie tutte non risolvibili: sequenza vuota, nessun errore', () => {
    const d = toProjectDetail({ _id: 'x', titleIt: 'Vuoto', slug: 'x', photos: null }, 'it')!
    const { container } = render(
      <ProjectSequence photos={d.photos} locale="it" dict={dict} />,
    )

    expect(container.querySelector('img')).toBeNull()
  })

  it('fotografia senza metadati di dimensione: rapporto di ripiego, niente NaN', () => {
    const d = toProjectDetail(
      {
        _id: 'x', titleIt: 'x', slug: 'x',
        photos: [{ _id: 'p', altIt: 'Alt', url: 'https://cdn.sanity.io/i/p/d/a-100x100.jpg', aspectRatio: null }],
      },
      'it',
    )!

    // Un NaN nel rapporto manderebbe in pezzi il packer e il riservo di spazio.
    expect(d.photos[0].ar).toBe(1)
    expect(Number.isNaN(d.photos[0].ar)).toBe(false)
  })

  it('descrizione assente in entrambe le lingue: la sezione non si rende vuota', () => {
    const d = toProjectDetail(
      { _id: 'x', titleIt: 'x', slug: 'x', descriptionIt: null, descriptionEn: null },
      'en',
    )!
    expect(d.description).toBe('')
  })
})
