import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZoomControls } from '../ZoomControls'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

function monta(props: Partial<Parameters<typeof ZoomControls>[0]> = {}) {
  const onIngrandisci = vi.fn()
  const onRiduci = vi.fn()
  const onAzzera = vi.fn()
  render(
    <ZoomControls
      dict={dict}
      ingrandito={false}
      alTetto={false}
      onIngrandisci={onIngrandisci}
      onRiduci={onRiduci}
      onAzzera={onAzzera}
      {...props}
    />,
  )
  return { onIngrandisci, onRiduci, onAzzera }
}

describe('ZoomControls', () => {
  it('a riposo mostra solo il comando per ingrandire', () => {
    monta()
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('da ingranditi compare il ritorno a schermo intero', () => {
    monta({ ingrandito: true })
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
  })

  /**
   * Al tetto il comando smette di funzionare, ma non sparisce dal giro del
   * Tab. Un `disabled` vero, premuto da tastiera, butta il fuoco sul body: il
   * Tab successivo ripartirebbe dal primo comando del dialog, cioe dalla
   * chiusura, e chi navigava si troverebbe a un tasto dal chiudere per sbaglio
   * la fotografia che stava guardando.
   */
  it('al tetto il comando per ingrandire e inerte ma tiene il fuoco', async () => {
    const { onIngrandisci } = monta({ ingrandito: true, alTetto: true })
    const pulsante = screen.getByRole('button', { name: dict.lightboxZoomIn })
    expect(pulsante).toHaveAttribute('aria-disabled', 'true')
    expect(pulsante).not.toBeDisabled()

    pulsante.focus()
    await userEvent.click(pulsante)
    expect(onIngrandisci).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(pulsante)
  })

  it('chiama i comandi giusti', async () => {
    const { onIngrandisci, onAzzera } = monta({ ingrandito: true })
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    expect(onIngrandisci).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomReset }))
    expect(onAzzera).toHaveBeenCalled()
  })
})
