import { describe, it, expect, vi } from 'vitest'
import { findDuplicatePhoto } from '../dedupe'

type Documento = { _id: string }

/**
 * Client finto che registra la configurazione richiesta.
 *
 * `withConfig` conta quanto il risultato: interrogare con la perspective
 * predefinita e il difetto che questi test esistono per impedire.
 */
function clientCon(documenti: Documento[]) {
  const fetch = vi.fn(async () => documenti)
  const withConfig = vi.fn(() => ({ fetch }))
  return { client: { withConfig } as never, fetch, withConfig }
}

describe('findDuplicatePhoto', () => {
  it('trova una photo che usa lo stesso asset', async () => {
    const { client } = clientCon([{ _id: 'photo-the-wall' }])

    expect(await findDuplicatePhoto(client, 'image-abc')).toEqual({ _id: 'photo-the-wall' })
  })

  it('restituisce null quando l asset non e referenziato', async () => {
    const { client } = clientCon([])

    expect(await findDuplicatePhoto(client, 'image-mai-vista')).toBeNull()
  })

  /**
   * Il caso che rende il tool utilizzabile due volte di fila: le bozze che il
   * tool stesso ha appena creato non sono pubblicate, e con la perspective
   * predefinita non esisterebbero. Ricaricando lo stesso file si otterrebbe
   * un secondo documento invece della segnalazione di duplicato.
   */
  it('trova anche quando la photo esistente e solo una bozza', async () => {
    const { client } = clientCon([{ _id: 'drafts.photo-the-wall' }])

    expect(await findDuplicatePhoto(client, 'image-abc')).toEqual({ _id: 'drafts.photo-the-wall' })
  })

  it('interroga con perspective raw', async () => {
    const { client, withConfig } = clientCon([])
    await findDuplicatePhoto(client, 'image-abc')

    expect(withConfig).toHaveBeenCalledWith({ perspective: 'raw' })
  })

  it('preferisce il documento pubblicato quando esistono entrambi', async () => {
    // `drafts.x` e `x` sono lo stesso documento, non due: segnalarli entrambi
    // direbbe all editor che ci sono due copie della stessa fotografia.
    const { client } = clientCon([{ _id: 'drafts.photo-the-wall' }, { _id: 'photo-the-wall' }])

    expect(await findDuplicatePhoto(client, 'image-abc')).toEqual({ _id: 'photo-the-wall' })
  })

  it('non interpola l id dell asset nella query', async () => {
    const { client, fetch } = clientCon([])
    await findDuplicatePhoto(client, 'image-abc')

    const [query, params] = fetch.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(query).toContain('$assetId')
    expect(query).not.toContain('image-abc')
    expect(params).toEqual({ assetId: 'image-abc' })
  })

  it('regge una risposta nulla invece di rompersi', async () => {
    const fetch = vi.fn(async () => null)
    const client = { withConfig: vi.fn(() => ({ fetch })) } as never

    expect(await findDuplicatePhoto(client, 'image-abc')).toBeNull()
  })
})
