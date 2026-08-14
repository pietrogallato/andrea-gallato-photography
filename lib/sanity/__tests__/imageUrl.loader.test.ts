import { describe, it, expect } from 'vitest'
import sanityImageLoader from '../imageUrl.loader'

const SRC = 'https://cdn.sanity.io/images/p/d/abc-4000x3000.jpg'

describe('sanityImageLoader', () => {
  /**
   * La qualita predefinita e stata **misurata**, non scelta per abitudine:
   * sulla galleria intera, da 85 a 80 si risparmia mezzo megabyte sulla
   * pagina mobile senza differenza visibile. Il test la fissa perche un
   * numero tarato che vive solo in un commento torna al valore di prima alla
   * prima modifica distratta.
   */
  it('usa la qualita tarata quando nessuno ne chiede una', () => {
    expect(sanityImageLoader({ src: SRC, width: 1080 })).toContain('q=80')
  })

  it('rispetta una qualita esplicita', () => {
    expect(sanityImageLoader({ src: SRC, width: 1080, quality: 92 })).toContain('q=92')
  })

  it('aggancia la larghezza al gradino della scala', () => {
    // 700 non e un gradino: si sale a 828, mai si scende.
    expect(sanityImageLoader({ src: SRC, width: 700 })).toContain('w=828')
  })

  it('non chiede piu della larghezza nativa dell asset', () => {
    // L asset e largo 4000: chiedere 3840 va bene, chiedere di piu no.
    expect(sanityImageLoader({ src: SRC, width: 5000 })).toContain('w=3840')
  })
})
