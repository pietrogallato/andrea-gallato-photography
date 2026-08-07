import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/lib/sanity/fetch', () => ({ sanityFetch: fetchMock }))

const { loadMorePhotos, PAGE_SIZE } = await import('../loadMorePhotos')

function photo(i: number) {
  return {
    _id: `p${i}`,
    altIt: `Foto ${i}`,
    url: `https://cdn.sanity.io/images/p/d/x${i}-3000x2000.jpg`,
    aspectRatio: 1.5,
    lqip: null,
  }
}

describe('loadMorePhotos', () => {
  beforeEach(() => fetchMock.mockReset())

  it('chiede esattamente un gruppo a partire dall offset', async () => {
    fetchMock.mockResolvedValueOnce(0).mockResolvedValueOnce([])
    await loadMorePhotos(24, 'it')

    const call = fetchMock.mock.calls.find((c) => c[0].params?.start !== undefined)
    expect(call?.[0].params).toEqual({ start: 24, end: 24 + PAGE_SIZE })
  })

  it('dichiara hasMore quando restano fotografie oltre il gruppo', async () => {
    fetchMock
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(Array.from({ length: PAGE_SIZE }, (_, i) => photo(i)))

    const result = await loadMorePhotos(0, 'it')
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(100)
  })

  it('dichiara hasMore falso sull ultimo gruppo parziale', async () => {
    fetchMock.mockResolvedValueOnce(30).mockResolvedValueOnce([photo(0), photo(1)])

    const result = await loadMorePhotos(24, 'it')
    expect(result.hasMore).toBe(false)
  })

  it('dichiara hasMore falso quando il gruppo chiude esattamente il totale', async () => {
    fetchMock
      .mockResolvedValueOnce(48)
      .mockResolvedValueOnce(Array.from({ length: PAGE_SIZE }, (_, i) => photo(i)))

    const result = await loadMorePhotos(24, 'it')
    expect(result.hasMore).toBe(false)
  })

  it('restituisce righe gia impaccate, cosi l append non ricalcola nulla', async () => {
    fetchMock.mockResolvedValueOnce(48).mockResolvedValueOnce([photo(0), photo(1), photo(2)])

    const result = await loadMorePhotos(0, 'it')
    expect(Array.isArray(result.rows)).toBe(true)
    expect(result.rows.flatMap((r) => r.items.map((i) => i.id))).toEqual(['p0', 'p1', 'p2'])
  })

  it('restituisce un risultato vuoto oltre il totale', async () => {
    fetchMock.mockResolvedValueOnce(10).mockResolvedValueOnce([])

    const result = await loadMorePhotos(240, 'it')
    expect(result.rows).toEqual([])
    expect(result.hasMore).toBe(false)
  })
})
