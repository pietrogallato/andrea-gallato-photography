import { describe, it, expect } from 'vitest'
import { segretoCorretto } from '../segreto'

describe('segretoCorretto', () => {
  it('accetta il segreto giusto', () => {
    expect(segretoCorretto('parola-lunga-e-segreta', 'parola-lunga-e-segreta')).toBe(true)
  })

  it('rifiuta un segreto diverso', () => {
    expect(segretoCorretto('parola-lunga-e-segreta', 'parola-lunga-e-segretb')).toBe(false)
  })

  it('rifiuta lunghezze diverse senza lanciare', () => {
    // `timingSafeEqual` lancia su buffer di lunghezza diversa: confrontare i
    // digest e cio che rende la funzione totale invece che esplosiva.
    expect(segretoCorretto('corto', 'molto piu lungo del precedente')).toBe(false)
    expect(segretoCorretto('molto piu lungo del precedente', 'corto')).toBe(false)
  })

  /**
   * Senza segreto configurato l'anteprima deve restare chiusa: l'alternativa
   * — trattare «nessun segreto» come «qualunque segreto va bene» — aprirebbe
   * le bozze a chiunque proprio nel caso in cui qualcuno ha dimenticato di
   * configurare la variabile.
   */
  it('nega quando il segreto non e configurato', () => {
    expect(segretoCorretto(undefined, 'qualsiasi')).toBe(false)
    expect(segretoCorretto('', 'qualsiasi')).toBe(false)
    expect(segretoCorretto(undefined, null)).toBe(false)
  })

  it('nega quando la richiesta non porta alcun segreto', () => {
    expect(segretoCorretto('parola-segreta', null)).toBe(false)
    expect(segretoCorretto('parola-segreta', '')).toBe(false)
  })
})
