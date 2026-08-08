import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag }))

const isValidSignature = vi.fn()
vi.mock('@sanity/webhook', () => ({
  isValidSignature: (...a: unknown[]) => isValidSignature(...a),
  SIGNATURE_HEADER_NAME: 'sanity-webhook-signature',
}))

vi.mock('@/lib/revalidation/dependents', () => ({
  resolveDependentTags: vi.fn(async () => []),
}))

const { POST } = await import('../route')

function richiesta(body: unknown, firma?: string) {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: firma ? { 'sanity-webhook-signature': firma } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    isValidSignature.mockReset()
    process.env.SANITY_REVALIDATE_SECRET = 'segreto'
  })

  it('rifiuta una richiesta senza firma', async () => {
    const res = await POST(richiesta({ _type: 'photo', _id: 'x' }))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rifiuta una firma non valida', async () => {
    isValidSignature.mockResolvedValue(false)
    const res = await POST(richiesta({ _type: 'photo', _id: 'x' }, 'sbagliata'))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('attende la verifica, che e asincrona', async () => {
    // isValidSignature restituisce una Promise: senza await la condizione e
    // sempre falsa e QUALUNQUE richiesta passerebbe. Verificato sul pacchetto
    // installato, non assunto.
    isValidSignature.mockResolvedValue(false)
    await POST(richiesta({ _type: 'photo', _id: 'x' }, 'sbagliata'))
    expect(isValidSignature).toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rifiuta anche senza segreto configurato', async () => {
    delete process.env.SANITY_REVALIDATE_SECRET
    const res = await POST(richiesta({ _type: 'photo', _id: 'x' }, 'qualsiasi'))
    expect(res.status).toBe(401)
  })

  it('non espone dettagli nel rifiuto', async () => {
    isValidSignature.mockResolvedValue(false)
    const res = await POST(richiesta({ _type: 'photo', _id: 'x' }, 'x'))
    expect(await res.text()).toBe('')
  })

  it('verifica la firma sul corpo grezzo, non su un JSON riserializzato', async () => {
    isValidSignature.mockResolvedValue(true)
    const corpo = { _type: 'homePage', _id: 'homePage' }
    await POST(richiesta(corpo, 'ok'))

    // Una riserializzazione puo cambiare la codifica e far fallire il
    // confronto in modo intermittente.
    expect(isValidSignature).toHaveBeenCalledWith(JSON.stringify(corpo), 'ok', 'segreto')
  })

  it('applica i tag con firma valida', async () => {
    isValidSignature.mockResolvedValue(true)
    const res = await POST(richiesta({ _type: 'project', _id: 'x', slug: 'nebbia' }, 'ok'))

    expect(res.status).toBe(200)
    const applicati = revalidateTag.mock.calls.map((c) => c[0])
    expect(applicati).toContain('project:nebbia')
    expect(applicati).toContain('projects-index')
  })

  it('chiede scadenza immediata, non il comportamento predefinito', async () => {
    isValidSignature.mockResolvedValue(true)
    await POST(richiesta({ _type: 'homePage', _id: 'homePage' }, 'ok'))

    // Su Next 16 la forma a un argomento e deprecata e il default non scade
    // subito: senza il secondo argomento la pubblicazione non si vedrebbe.
    expect(revalidateTag).toHaveBeenCalledWith('home', { expire: 0 })
  })

  it('e idempotente: due chiamate identiche non fanno danni', async () => {
    isValidSignature.mockResolvedValue(true)
    const corpo = { _type: 'aboutPage', _id: 'aboutPage' }
    const a = await POST(richiesta(corpo, 'ok'))
    const b = await POST(richiesta(corpo, 'ok'))
    expect([a.status, b.status]).toEqual([200, 200])
  })

  it('risponde 400 a un corpo non analizzabile invece di lanciare', async () => {
    isValidSignature.mockResolvedValue(true)
    const res = await POST(
      new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: { 'sanity-webhook-signature': 'ok' },
        body: 'non-e-json',
      }),
    )
    expect(res.status).toBe(400)
  })
})
