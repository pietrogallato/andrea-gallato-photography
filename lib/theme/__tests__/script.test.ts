import { describe, it, expect, beforeEach } from 'vitest'
import { THEME_STORAGE_KEY, THEME_SCRIPT } from '../script'

function runScript() {
  new Function(THEME_SCRIPT)()
}

describe('script anti-flash', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applica il tema chiaro memorizzato', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applica il tema scuro memorizzato', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('non tocca l attributo quando non c è nulla di memorizzato', () => {
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('ignora un valore memorizzato non valido', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'fucsia')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('non lancia se localStorage non è accessibile', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('bloccato') },
    })
    expect(() => runScript()).not.toThrow()
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})
