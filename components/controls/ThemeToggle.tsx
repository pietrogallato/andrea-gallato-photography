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

  const isLight = theme === 'light'

  return (
    <button type="button" className={styles.toggle} aria-pressed={isLight} onClick={toggle}>
      {/* L etichetta resta statica e resta il nome accessibile: un etichetta
          imperativa che cambia con lo stato, letta insieme ad aria-pressed,
          produrrebbe l annuncio contraddittorio "passa al tema chiaro,
          premuto". Lo stato lo comunica aria-pressed, non il testo. */}
      <span className="visually-hidden">{label}</span>

      <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="5" fill={isLight ? 'currentColor' : 'none'} strokeWidth="1.25" />
        <g strokeWidth="1.25" strokeLinecap="round" className={styles.rays}>
          <path d="M12 1.5v2.5M12 20v2.5M22.5 12H20M4 12H1.5" />
          <path d="M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8M19.4 19.4l-1.8-1.8M6.4 6.4L4.6 4.6" />
        </g>
      </svg>
    </button>
  )
}
