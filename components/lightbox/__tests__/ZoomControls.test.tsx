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

  it('al tetto il comando per ingrandire e disabilitato', () => {
    // E' cosi che ci si accorge di essere arrivati: non c e alcun annuncio.
    monta({ ingrandito: true, alTetto: true })
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeDisabled()
  })

  it('chiama i comandi giusti', async () => {
    const { onIngrandisci, onAzzera } = monta({ ingrandito: true })
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    expect(onIngrandisci).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomReset }))
    expect(onAzzera).toHaveBeenCalled()
  })
})
