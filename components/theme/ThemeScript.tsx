'use client'

/**
 * Script anti-flash del tema.
 *
 * Sul server il tipo e eseguibile, quindi lo script gira nel <head> prima del
 * primo paint ed e li che serve. Sul client il tipo diventa inerte: React non
 * esegue comunque gli script inline durante una riconciliazione, e lasciarlo
 * eseguibile fa emettere l errore "Encountered a script tag while rendering
 * React component" a ogni navigazione che rimonta il layout radice, per
 * esempio al cambio di lingua.
 *
 * `suppressHydrationWarning` copre la differenza voluta del solo attributo
 * `type` fra server e client.
 */
export function ThemeScript({ source }: { source: string }) {
  const type = typeof window === 'undefined' ? 'text/javascript' : 'text/plain'

  return (
    <script
      type={type}
      dangerouslySetInnerHTML={{ __html: source }}
      suppressHydrationWarning
    />
  )
}
