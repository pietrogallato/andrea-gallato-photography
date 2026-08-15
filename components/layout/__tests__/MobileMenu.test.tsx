import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileMenu } from '../MobileMenu'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const props = {
  locale: 'it' as const,
  dict,
  localeNames: { it: dict.localeNameIt, en: dict.localeNameEn },
}

describe('MobileMenu', () => {
  it('parte chiuso e lo dichiara', () => {
    render(<MobileMenu {...props} />)
    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveAttribute('aria-expanded', 'false')
  })

  it('collega il trigger al pannello che controlla', () => {
    render(<MobileMenu {...props} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })
    const id = trigger.getAttribute('aria-controls')

    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toBeInTheDocument()
  })

  it('apre e aggiorna aria-expanded', async () => {
    render(<MobileMenu {...props} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('button', { name: dict.closeMenu })).toHaveAttribute('aria-expanded', 'true')
  })

  it('chiude con Esc e restituisce il focus al trigger', async () => {
    render(<MobileMenu {...props} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveFocus()
  })

  it('espone il collegamento alla galleria quando aperto', async () => {
    render(<MobileMenu {...props} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('link', { name: dict.navGallery })).toHaveAttribute('href', '/it/fotografie')
  })
  it('ospita il selettore lingua, che sotto il breakpoint esce dall header', async () => {
    render(<MobileMenu {...props} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    // Nome e selettore lingua su una riga sola sfondavano il viewport a 390px;
    // comprimerli avrebbe ridotto le aree di tocco sotto il minimo di 44px.
    // Il selettore vive quindi nel pannello.
    expect(screen.getByRole('navigation', { name: dict.localeGroup })).toBeInTheDocument()
  })
})
