import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchSpy = vi.fn(async () => ({ ok: true }))

vi.mock('../client', () => ({
  publicClient: { fetch: (...args: unknown[]) => fetchSpy(...(args as [])) },
  previewClient: { fetch: vi.fn() },
}))

const { sanityFetch } = await import('../fetch')

describe('sanityFetch', () => {
  beforeEach(() => fetchSpy.mockClear())

  it('richiede esplicitamente la cache, altrimenti i tag non invalidano nulla', async () => {
    await sanityFetch({ query: '*[_type=="photo"]', tags: ['gallery'] })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>]
    expect(options.cache).toBe('force-cache')
  })

  it('passa i tag e disattiva la revalidation a tempo, che è mutuamente esclusiva', async () => {
    await sanityFetch({ query: '*[_type=="photo"]', tags: ['gallery', 'photo:abc'] })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, { next: Record<string, unknown> }]
    expect(options.next.tags).toEqual(['gallery', 'photo:abc'])
    expect(options.next.revalidate).toBe(false)
  })

  it('usa un array di tag vuoto quando non ne vengono passati', async () => {
    await sanityFetch({ query: '*[_type=="photo"]' })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, { next: Record<string, unknown> }]
    expect(options.next.tags).toEqual([])
  })
})
