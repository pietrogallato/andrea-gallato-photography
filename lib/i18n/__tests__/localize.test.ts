import { describe, it, expect } from 'vitest'
import { pickLocalized } from '../localize'

describe('pickLocalized', () => {
  it('usa l inglese sulla pagina inglese quando è valorizzato', () => {
    expect(pickLocalized({ it: 'Nebbia', en: 'Fog' }, 'en')).toEqual({ value: 'Fog', lang: 'en' })
  })

  it('usa l italiano sulla pagina italiana', () => {
    expect(pickLocalized({ it: 'Nebbia', en: 'Fog' }, 'it')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('ricade sull italiano quando l inglese manca, dichiarando la lingua', () => {
    expect(pickLocalized({ it: 'Nebbia' }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
    expect(pickLocalized({ it: 'Nebbia', en: null }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('tratta una stringa inglese di soli spazi come non valorizzata', () => {
    expect(pickLocalized({ it: 'Nebbia', en: '   ' }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('ricade sull inglese se l italiano manca sulla pagina italiana', () => {
    expect(pickLocalized({ en: 'Fog' }, 'it')).toEqual({ value: 'Fog', lang: 'en' })
  })

  it('restituisce stringa vuota quando entrambi mancano', () => {
    expect(pickLocalized({}, 'en')).toEqual({ value: '', lang: 'en' })
    expect(pickLocalized(null, 'it')).toEqual({ value: '', lang: 'it' })
    expect(pickLocalized(undefined, 'it')).toEqual({ value: '', lang: 'it' })
  })

  it('rimuove gli spazi ai bordi del valore restituito', () => {
    expect(pickLocalized({ it: '  Nebbia  ' }, 'it')).toEqual({ value: 'Nebbia', lang: 'it' })
  })
})
