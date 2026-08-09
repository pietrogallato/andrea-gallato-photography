import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import { PrimaryNav } from '../PrimaryNav'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

function setPath(path: string) {
  vi.mocked(usePathname).mockReturnValue(path)
}

beforeEach(() => {
  setPath('/it')
})

describe('PrimaryNav', () => {
  it('linka le tre voci con i segmenti della lingua corrente', () => {
    render(<PrimaryNav locale="it" dict={dict} />)

    expect(screen.getByRole('link', { name: dict.navGallery })).toHaveAttribute('href', '/it/fotografie')
    expect(screen.getByRole('link', { name: dict.navProjects })).toHaveAttribute('href', '/it/progetti')
    expect(screen.getByRole('link', { name: dict.navAbout })).toHaveAttribute('href', '/it/about')
  })

  it('usa i segmenti inglesi in inglese', () => {
    setPath('/en')
    render(<PrimaryNav locale="en" dict={getDictionary('en')} />)

    expect(screen.getByRole('link', { name: 'Photographs' })).toHaveAttribute('href', '/en/photographs')
  })

  it('segna la pagina corrente, e solo quella', () => {
    setPath('/it/fotografie')
    render(<PrimaryNav locale="it" dict={dict} />)

    expect(screen.getByRole('link', { name: dict.navGallery })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: dict.navProjects })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: dict.navAbout })).not.toHaveAttribute('aria-current')
  })

  /**
   * Dentro un progetto la voce Progetti deve restare accesa: altrimenti
   * scendendo nel dettaglio si perde il segno di dove si e.
   */
  it('tiene accesa la voce Progetti anche dentro la pagina di un progetto', () => {
    setPath('/it/progetti/concorso-trieste')
    render(<PrimaryNav locale="it" dict={dict} />)

    expect(screen.getByRole('link', { name: dict.navProjects })).toHaveAttribute('aria-current', 'page')
  })

  it('sulla home non segna nessuna voce', () => {
    setPath('/it')
    render(<PrimaryNav locale="it" dict={dict} />)

    for (const nome of [dict.navGallery, dict.navProjects, dict.navAbout]) {
      expect(screen.getByRole('link', { name: nome })).not.toHaveAttribute('aria-current')
    }
  })

  /**
   * Un prefisso non basta a dichiarare la corrispondenza: `/it/about` non deve
   * accendere una eventuale voce `/it/ab`. Il confronto e sul segmento intero.
   */
  it('non confonde percorsi che iniziano allo stesso modo', () => {
    setPath('/it/progetti-vecchi')
    render(<PrimaryNav locale="it" dict={dict} />)

    expect(screen.getByRole('link', { name: dict.navProjects })).not.toHaveAttribute('aria-current')
  })

  it('avvisa chi lo ospita quando si sceglie una voce, cosi il menu si chiude', async () => {
    const onNavigate = vi.fn()
    render(<PrimaryNav locale="it" dict={dict} onNavigate={onNavigate} />)

    await userEvent.click(screen.getByRole('link', { name: dict.navAbout }))

    expect(onNavigate).toHaveBeenCalledOnce()
  })
})
