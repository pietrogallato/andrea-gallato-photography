import { describe, it, expect } from 'vitest'
import { LOCALES, DEFAULT_LOCALE, isLocale } from '../locales'

describe('locales', () => {
  it('espone italiano e inglese, con italiano come default', () => {
    expect(LOCALES).toEqual(['it', 'en'])
    expect(DEFAULT_LOCALE).toBe('it')
  })

  it('riconosce i locale supportati', () => {
    expect(isLocale('it')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })

  it('rifiuta qualunque altro valore', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('IT')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})
