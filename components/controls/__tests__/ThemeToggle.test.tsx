import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '../ThemeToggle'
import { THEME_STORAGE_KEY } from '@/lib/theme/script'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  it('ha un nome accessibile statico che non cambia con lo stato', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    const button = screen.getByRole('button', { name: 'Tema chiaro' })

    await userEvent.click(button)

    expect(screen.getByRole('button', { name: 'Tema chiaro' })).toBeInTheDocument()
  })

  it('parte non premuto sul tema scuro', () => {
    render(<ThemeToggle label="Tema chiaro" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('passa al tema chiaro e lo comunica con aria-pressed', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('memorizza la preferenza', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('torna al tema scuro al secondo clic', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    const button = screen.getByRole('button')

    await userEvent.click(button)
    await userEvent.click(button)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('non lancia se localStorage non è scrivibile', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('bloccato') },
    })

    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})
