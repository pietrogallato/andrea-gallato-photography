import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLightbox } from '../useLightbox'

function Prova() {
  const { openIndex, open, close, navigate } = useLightbox()

  return (
    <div>
      <button onClick={(e) => open(2, e.currentTarget)}>apri</button>
      <button onClick={() => navigate(3)}>avanti</button>
      <button onClick={close}>chiudi</button>
      <output>{openIndex === null ? 'chiusa' : String(openIndex)}</output>
    </div>
  )
}

describe('useLightbox', () => {
  it('parte chiusa', () => {
    render(<Prova />)
    expect(screen.getByRole('status')).toHaveTextContent('chiusa')
  })

  it('apre sull indice richiesto', async () => {
    render(<Prova />)
    await userEvent.click(screen.getByRole('button', { name: 'apri' }))
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('naviga fra le fotografie', async () => {
    render(<Prova />)
    await userEvent.click(screen.getByRole('button', { name: 'apri' }))
    await userEvent.click(screen.getByRole('button', { name: 'avanti' }))
    expect(screen.getByRole('status')).toHaveTextContent('3')
  })

  it('restituisce il focus all elemento di origine alla chiusura', async () => {
    render(<Prova />)
    const apri = screen.getByRole('button', { name: 'apri' })

    await userEvent.click(apri)
    await userEvent.click(screen.getByRole('button', { name: 'chiudi' }))

    expect(apri).toHaveFocus()
  })

  it('accetta un origine assente senza lanciare', async () => {
    // Un apertura da tastiera su un elemento gia smontato, o da codice che
    // non ha un elemento da passare, non deve rompere la chiusura.
    function SenzaOrigine() {
      const { openIndex, open, close } = useLightbox()
      return (
        <div>
          <button onClick={() => open(0, null)}>apri</button>
          <button onClick={close}>chiudi</button>
          <output>{openIndex === null ? 'chiusa' : 'aperta'}</output>
        </div>
      )
    }

    render(<SenzaOrigine />)
    await userEvent.click(screen.getByRole('button', { name: 'apri' }))
    await userEvent.click(screen.getByRole('button', { name: 'chiudi' }))
    expect(screen.getByRole('status')).toHaveTextContent('chiusa')
  })
})
