import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { siteUrl } from '../siteUrl'

const CHIAVI = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const
const originali: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of CHIAVI) {
    originali[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of CHIAVI) {
    if (originali[k] === undefined) delete process.env[k]
    else process.env[k] = originali[k]
  }
})

describe('siteUrl', () => {
  it('preferisce il dominio dichiarato a qualunque valore di Vercel', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://andreagallato.it'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'progetto.vercel.app'
    expect(siteUrl()).toBe('https://andreagallato.it')
  })

  it('rimuove la barra finale, che raddoppierebbe nelle URL composte', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://andreagallato.it/'
    expect(siteUrl()).toBe('https://andreagallato.it')
  })

  it('usa l URL di produzione di Vercel, stabile fra i deploy', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'progetto.vercel.app'
    process.env.VERCEL_URL = 'progetto-abc123.vercel.app'
    expect(siteUrl()).toBe('https://progetto.vercel.app')
  })

  it('ricade sull URL del singolo deploy nelle anteprime', () => {
    process.env.VERCEL_URL = 'progetto-abc123.vercel.app'
    expect(siteUrl()).toBe('https://progetto-abc123.vercel.app')
  })

  it('ricade su localhost in sviluppo', () => {
    expect(siteUrl()).toBe('http://localhost:3000')
  })

  it('ignora i valori composti di soli spazi', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   '
    process.env.VERCEL_URL = 'progetto-abc123.vercel.app'
    expect(siteUrl()).toBe('https://progetto-abc123.vercel.app')
  })
})
