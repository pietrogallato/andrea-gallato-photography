import { describe, it, expect } from 'vitest'
import { getDictionary } from '../dictionaries'
import { it as itDict } from '../dictionaries/it'
import { en as enDict } from '../dictionaries/en'

describe('dizionari', () => {
  it('restituisce il dizionario della lingua richiesta', () => {
    expect(getDictionary('it')).toBe(itDict)
    expect(getDictionary('en')).toBe(enDict)
  })

  it('ha esattamente le stesse chiavi nelle due lingue', () => {
    expect(Object.keys(enDict).sort()).toEqual(Object.keys(itDict).sort())
  })

  it('non ha valori vuoti', () => {
    for (const [key, value] of Object.entries(itDict)) {
      expect(value, `it.${key}`).not.toBe('')
    }
    for (const [key, value] of Object.entries(enDict)) {
      expect(value, `en.${key}`).not.toBe('')
    }
  })

  it('scrive il nome di ciascuna lingua nella lingua stessa', () => {
    expect(itDict.localeNameIt).toBe('Italiano')
    expect(itDict.localeNameEn).toBe('English')
    expect(enDict.localeNameIt).toBe('Italiano')
    expect(enDict.localeNameEn).toBe('English')
  })
})
