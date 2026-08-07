import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileMenu } from '../MobileMenu'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

describe('MobileMenu', () => {
  it('parte chiuso e lo dichiara', () => {
    render(<MobileMenu locale="it" dict={dict} />)
    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveAttribute('aria-expanded', 'false')
  })

  it('collega il trigger al pannello che controlla', () => {
    render(<MobileMenu locale="it" dict={dict} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })
    const id = trigger.getAttribute('aria-controls')

    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toBeInTheDocument()
  })

  it('apre e aggiorna aria-expanded', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('button', { name: dict.closeMenu })).toHaveAttribute('aria-expanded', 'true')
  })

  it('chiude con Esc e restituisce il focus al trigger', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    const trigger = screen.getByRole('button', { name: dict.openMenu })

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: dict.openMenu })).toHaveFocus()
  })

  it('espone il collegamento alla galleria quando aperto', async () => {
    render(<MobileMenu locale="it" dict={dict} />)
    await userEvent.click(screen.getByRole('button', { name: dict.openMenu }))

    expect(screen.getByRole('link', { name: dict.navGallery })).toHaveAttribute('href', '/it/fotografie')
  })
})
