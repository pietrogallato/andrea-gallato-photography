import { describe, it, expect } from 'vitest'
import { resolveRoute } from '@/lib/i18n/routes'
import { isLocale } from '@/lib/i18n/locales'

// Riproduce la logica di guardia della catch-all come funzione pura,
// così il contratto è testabile senza rendere un Server Component async.
function routeOrNull(locale: string, segments: string[] = []) {
  if (!isLocale(locale)) return null
  return resolveRoute(locale, segments)
}

describe('guardia della catch-all', () => {
  it('accetta le home localizzate', () => {
    expect(routeOrNull('it', [])).toEqual({ key: 'home' })
    expect(routeOrNull('en', [])).toEqual({ key: 'home' })
  })

  it('rifiuta un locale non supportato', () => {
    expect(routeOrNull('fr', [])).toBeNull()
    expect(routeOrNull('fr', ['fotografie'])).toBeNull()
    expect(routeOrNull('IT', [])).toBeNull()
  })

  it('rifiuta il nome canonico interno', () => {
    expect(routeOrNull('it', ['gallery'])).toBeNull()
  })

  it('rifiuta il segmento della lingua sbagliata', () => {
    expect(routeOrNull('it', ['photographs'])).toBeNull()
  })
})
