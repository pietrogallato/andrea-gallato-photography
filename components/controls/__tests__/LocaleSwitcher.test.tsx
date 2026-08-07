import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LocaleSwitcher } from '../LocaleSwitcher'

const paths = { it: '/it/fotografie', en: '/en/photographs' }

describe('LocaleSwitcher', () => {
  it('rende due link, non un select', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('marca la lingua attiva con aria-current', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('link', { name: 'Italiano' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'English' })).not.toHaveAttribute('aria-current')
  })

  it('marca il link verso l altra lingua con lang e hreflang', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    const other = screen.getByRole('link', { name: 'English' })
    expect(other).toHaveAttribute('lang', 'en')
    expect(other).toHaveAttribute('hreflang', 'en')
  })

  it('punta al percorso equivalente nell altra lingua', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/photographs')
  })

  it('espone un nome accessibile al gruppo', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('navigation', { name: 'Lingua' })).toBeInTheDocument()
  })
})
