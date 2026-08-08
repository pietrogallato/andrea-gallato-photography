'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Stato della lightbox, condiviso fra galleria e pagine di progetto.
 *
 * L elemento di origine viene passato esplicitamente a `open` invece di essere
 * dedotto da `document.activeElement`: Safari non sposta il focus su un button
 * quando lo si clicca, quindi l origine dedotta sarebbe `<body>` e alla
 * chiusura il focus non tornerebbe alla fotografia.
 */
export function useLightbox() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const originRef = useRef<HTMLElement | null>(null)

  function open(index: number, origin: HTMLElement | null) {
    originRef.current = origin
    setOpenIndex(index)
  }

  function close() {
    setOpenIndex(null)
  }

  // Il focus va restituito DOPO lo smontaggio, non dentro `close`: li React
  // non ha ancora rimosso la dialog, e chiudendola il browser sposterebbe di
  // nuovo il focus subito dopo. Un effect gira a commit avvenuto.
  useEffect(() => {
    if (openIndex === null) originRef.current?.focus()
  }, [openIndex])

  return { openIndex, open, close, navigate: setOpenIndex }
}
