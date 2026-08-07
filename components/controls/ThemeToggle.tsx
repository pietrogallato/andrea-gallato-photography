'use client'

import { useLayoutEffect, useState } from 'react'
import { THEME_STORAGE_KEY, DEFAULT_THEME, type Theme } from '@/lib/theme/script'
import styles from './ThemeToggle.module.css'

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage non accessibile: resta il default
  }
  return DEFAULT_THEME
}

export function ThemeToggle({ label }: { label: string }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useLayoutEffect(() => {
    const current = readStoredTheme()
    setTheme(current)
    document.documentElement.setAttribute('data-theme', current)
  }, [])

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // preferenza non memorizzabile: il tema resta applicato per questa sessione
    }
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={theme === 'light'}
      onClick={toggle}
    >
      {label}
    </button>
  )
}
