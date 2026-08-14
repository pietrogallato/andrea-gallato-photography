import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  PHASE_DEVELOPMENT_SERVER,
} from 'next/constants'
import { persistedFetchCacheDir, clearPersistedFetchCache } from '../fetchCache'

let dir: string
let distDir: string

/** Ricrea l'albero che Vercel ripristina fra un deploy e l'altro. */
function seedCache() {
  mkdirSync(path.join(distDir, 'cache', 'fetch-cache'), { recursive: true })
  writeFileSync(path.join(distDir, 'cache', 'fetch-cache', 'abc123'), '{"kind":"FETCH"}')
  mkdirSync(path.join(distDir, 'cache', 'turbopack'), { recursive: true })
  writeFileSync(path.join(distDir, 'cache', 'turbopack', 'chunk'), 'x')
}

const fetchCache = () => path.join(distDir, 'cache', 'fetch-cache')
const turbopackCache = () => path.join(distDir, 'cache', 'turbopack')

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'fetch-cache-'))
  distDir = path.join(dir, '.next')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('persistedFetchCacheDir', () => {
  it('e il percorso in cui Next persiste le risposte di fetch', () => {
    expect(persistedFetchCacheDir('.next')).toBe(path.join('.next', 'cache', 'fetch-cache'))
  })

  it('rispetta una distDir personalizzata', () => {
    expect(persistedFetchCacheDir('build')).toBe(path.join('build', 'cache', 'fetch-cache'))
  })
})

describe('clearPersistedFetchCache', () => {
  it('rimuove le risposte del build precedente, che altrimenti verrebbero riusate', () => {
    seedCache()

    const removed = clearPersistedFetchCache({ phase: PHASE_PRODUCTION_BUILD, distDir })

    expect(removed).toBe(fetchCache())
    expect(existsSync(fetchCache())).toBe(false)
  })

  it('non tocca la cache di compilazione, che rende i build veloci senza falsare i dati', () => {
    seedCache()

    clearPersistedFetchCache({ phase: PHASE_PRODUCTION_BUILD, distDir })

    expect(existsSync(turbopackCache())).toBe(true)
    expect(existsSync(path.join(turbopackCache(), 'chunk'))).toBe(true)
  })

  it.each([PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER])(
    'in fase %s non rimuove nulla: il server in esecuzione perderebbe la cache dei dati',
    (phase) => {
      seedCache()

      expect(clearPersistedFetchCache({ phase, distDir })).toBeNull()
      expect(existsSync(fetchCache())).toBe(true)
    },
  )

  it('al primo build non c e nulla da rimuovere e non fallisce', () => {
    expect(clearPersistedFetchCache({ phase: PHASE_PRODUCTION_BUILD, distDir })).toBeNull()
  })

  it('segnala la rimozione una volta sola: next build carica la configurazione piu volte', () => {
    seedCache()

    expect(clearPersistedFetchCache({ phase: PHASE_PRODUCTION_BUILD, distDir })).toBe(fetchCache())
    expect(clearPersistedFetchCache({ phase: PHASE_PRODUCTION_BUILD, distDir })).toBeNull()
    expect(existsSync(fetchCache())).toBe(false)
  })
})
