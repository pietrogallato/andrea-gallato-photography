import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants'

const clearPersistedFetchCache = vi.fn(() => null as string | null)

vi.mock('../scripts/build/fetchCache', () => ({
  persistedFetchCacheDir: (distDir: string) => `${distDir}/cache/fetch-cache`,
  clearPersistedFetchCache: (...args: unknown[]) => clearPersistedFetchCache(...(args as [])),
}))

const config = (await import('../next.config')).default

/**
 * La pulizia della cache dei fetch e efficace solo se `next.config.ts` resta
 * una funzione della fase: riportarlo a un oggetto costante farebbe sparire
 * l'unico punto in cui viene invocata, e i build tornerebbero a renderizzare i
 * dati del build precedente senza alcun segnale.
 */
describe('next.config', () => {
  beforeEach(() => clearPersistedFetchCache.mockClear())

  it('e una funzione della fase, non un oggetto costante', () => {
    expect(typeof config).toBe('function')
  })

  it('inoltra la fase alla pulizia della cache dei fetch', () => {
    config(PHASE_PRODUCTION_BUILD)

    expect(clearPersistedFetchCache).toHaveBeenCalledWith(
      expect.objectContaining({ phase: PHASE_PRODUCTION_BUILD }),
    )
  })

  it('delega la decisione alla pulizia anche fuori dal build', () => {
    config(PHASE_PRODUCTION_SERVER)

    expect(clearPersistedFetchCache).toHaveBeenCalledWith(
      expect.objectContaining({ phase: PHASE_PRODUCTION_SERVER }),
    )
  })

  it('restituisce la configurazione, con il loader di immagini personalizzato', () => {
    const result = config(PHASE_PRODUCTION_BUILD)

    expect(result.images?.loader).toBe('custom')
    expect(result.images?.loaderFile).toBe('./lib/sanity/imageLoader.ts')
  })
})
