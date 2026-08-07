import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoadMoreButton } from '../LoadMoreButton'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

describe('LoadMoreButton', () => {
  it('non compare quando non ci sono altre fotografie', () => {
    render(<LoadMoreButton hasMore={false} loading={false} error={false} dict={dict} onLoad={vi.fn()} />)
    expect(screen.queryByRole('button', { name: dict.loadMore })).toBeNull()
  })

  it('chiede il gruppo successivo al clic', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading={false} error={false} dict={dict} onLoad={onLoad} />)

    await userEvent.click(screen.getByRole('button', { name: dict.loadMore }))
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('usa aria-disabled durante il caricamento, per non perdere il focus', () => {
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={vi.fn()} />)
    const button = screen.getByRole('button')

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toHaveAttribute('disabled')
  })

  it('non richiede un secondo gruppo se e gia in caricamento', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={onLoad} />)

    await userEvent.click(screen.getByRole('button'))
    expect(onLoad).not.toHaveBeenCalled()
  })

  it('annuncia il caricamento in una regione di stato, non sulla griglia', () => {
    render(<LoadMoreButton hasMore loading error={false} dict={dict} onLoad={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(dict.loading)
  })

  it('offre un retry inline in caso di errore', async () => {
    const onLoad = vi.fn()
    render(<LoadMoreButton hasMore loading={false} error dict={dict} onLoad={onLoad} />)

    const retry = screen.getByRole('button', { name: dict.retry })
    await userEvent.click(retry)
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('comunica l errore nella regione di stato', () => {
    render(<LoadMoreButton hasMore loading={false} error dict={dict} onLoad={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(dict.errorGeneric)
  })
})
