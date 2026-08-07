'use client'

import { useEffect } from 'react'

/**
 * Blocco dello scroll di sfondo, iOS incluso.
 *
 * `overflow: hidden` su body NON blocca lo scroll touch su iOS Safari, e
 * showModal() non lo risolve: inertizzare il documento non impedisce lo
 * scorrimento. Serve position: fixed con ripristino esatto della posizione.
 * Il salto da scrollbar e gia coperto da scrollbar-gutter: stable nei token.
 */
export function useScrollLock() {
  useEffect(() => {
    const y = window.scrollY
    const body = document.body
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width }

    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      window.scrollTo(0, y)
    }
  }, [])
}
