'use client'

import { useEffect, useRef, useState } from 'react'
import { puntoRispettoAlCentro, type Punto } from '@/lib/lightbox/zoom'
import type { useZoom } from './useZoom'

/** Entro quanto tempo e quanto spazio due tocchi valgono per un doppio tocco. */
const DOPPIO_MS = 300
const DOPPIO_PX = 30

/**
 * Quanto la rotella ingrandisce.
 *
 * L'esponenziale rende il gesto uniforme: la stessa rotazione moltiplica
 * sempre per lo stesso fattore, invece di sommare una costante che a livelli
 * alti si sente pochissimo e a livelli bassi strattona.
 */
const SENSIBILITA_ROTELLA = 250

/**
 * Quanto dura il silenzio che dichiara finita una raffica di rotella.
 *
 * La rotella non ha un «dito alzato» che dica quando il gesto e finito, ma
 * finche dura va marcata come gesto, altrimenti ogni evento fa ripartire la
 * transizione di 200ms interrompendo la precedente e l'immagine insegue le
 * dita.
 *
 * **Soglia scelta il 2026-08-16, non misurata su un trackpad vero**: nessuno
 * qui poteva pizzicarne uno, e va confermata nel protocollo manuale insieme
 * al resto della pizzicata. Il ragionamento: gli eventi wheel di una raffica
 * sono accorpati al fotogramma, quindi a 60Hz distano circa 16ms; 120ms sono
 * sette fotogrammi, troppi perche il silenzio scatti in mezzo alla raffica e
 * pochi perche si senta l'attesa prima che la transizione torni.
 */
const FINE_ROTELLA_MS = 120

export function useGestiZoom({
  superficieRef,
  zoom,
}: {
  superficieRef: { current: HTMLElement | null }
  zoom: ReturnType<typeof useZoom>
}) {
  const [inGesto, setInGesto] = useState(false)

  /**
   * L'oggetto restituito da useZoom e nuovo a ogni render. Metterlo fra le
   * dipendenze dell'effect farebbe smontare e rimontare tutti i listener
   * decine di volte al secondo durante una pizzicata, azzerando ogni volta la
   * mappa dei puntatori e la distanza iniziale: il gesto non funzionerebbe
   * affatto. I gestori leggono invece il valore fresco da questo ref, e
   * l'effect si aggancia una volta sola.
   */
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  })

  useEffect(() => {
    const el = superficieRef.current
    if (!el) return

    const puntatori = new Map<number, Punto>()
    let distanzaIniziale = 0
    let livelloIniziale = 1
    let ultimo: Punto | null = null
    let ultimoTocco = { tempo: 0, x: 0, y: 0 }
    /**
     * Vero da quando un secondo dito tocca fino a quando lo schermo torna
     * libero. Serve perche una pizzicata finisce alzando le dita una alla
     * volta: guardando solo l'ultimo dito che si alza, quella fine ha tutte le
     * carte in regola per passare per un doppio tocco — stesso punto, pochi
     * millisecondi — e getterebbe via l'ingrandimento appena scelto. Il caso
     * tipico e la pizzicata con cui si torna a schermo intero: ci si riesce, e
     * la fotografia ribalza a 2x da sola.
     */
    let pizzicata = false
    let fineRotella: ReturnType<typeof setTimeout> | undefined

    function relativo(x: number, y: number): Punto {
      const r = el!.getBoundingClientRect()
      return puntoRispettoAlCentro({
        cliente: { x, y },
        rettangolo: { left: r.left, top: r.top, larghezza: r.width, altezza: r.height },
      })
    }

    function distanza(): number {
      const [a, b] = [...puntatori.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    function centro(): Punto {
      const [a, b] = [...puntatori.values()]
      return relativo((a.x + b.x) / 2, (a.y + b.y) / 2)
    }

    function giu(event: PointerEvent) {
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })
      el!.setPointerCapture(event.pointerId)

      if (puntatori.size === 2) {
        distanzaIniziale = distanza()
        livelloIniziale = zoomRef.current.livello
        ultimo = null
        pizzicata = true
      } else if (puntatori.size === 1) {
        ultimo = { x: event.clientX, y: event.clientY }
      }
      setInGesto(true)
    }

    function muovi(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (puntatori.size === 2 && distanzaIniziale > 0) {
        zoomRef.current.versoLivello((livelloIniziale * distanza()) / distanzaIniziale, centro())
        return
      }

      if (puntatori.size === 1 && ultimo && zoomRef.current.ingrandito) {
        zoomRef.current.sposta({ x: event.clientX - ultimo.x, y: event.clientY - ultimo.y })
        ultimo = { x: event.clientX, y: event.clientY }
      }
    }

    function su(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return

      // Doppio tocco, riconosciuto a mano invece che con `dblclick`: con
      // touch-action `none` il doppio tocco non e garantito arrivare come
      // dblclick su tutti i motori, e cosi mouse e dito seguono la stessa
      // strada, che e anche l unica che Playwright sa esercitare.
      const ora = event.timeStamp
      const vicino =
        Math.abs(event.clientX - ultimoTocco.x) < DOPPIO_PX &&
        Math.abs(event.clientY - ultimoTocco.y) < DOPPIO_PX
      if (pizzicata) {
        // Le dita che si alzano dopo una pizzicata non sono tocchi: ne l una
        // ne l altra, quindi nemmeno la prima puo fare da primo tempo di un
        // doppio tocco con quella che resta.
        ultimoTocco = { tempo: 0, x: 0, y: 0 }
      } else if (puntatori.size === 1 && ora - ultimoTocco.tempo < DOPPIO_MS && vicino) {
        zoomRef.current.alDoppioTocco(relativo(event.clientX, event.clientY))
        ultimoTocco = { tempo: 0, x: 0, y: 0 }
      } else {
        ultimoTocco = { tempo: ora, x: event.clientX, y: event.clientY }
      }

      puntatori.delete(event.pointerId)
      el!.releasePointerCapture(event.pointerId)
      if (puntatori.size < 2) distanzaIniziale = 0
      if (puntatori.size === 0) {
        ultimo = null
        pizzicata = false
        setInGesto(false)
      }
    }

    // addEventListener a mano, non onWheel in JSX: **verificato nel sorgente
    // installato** (react-dom 19.2.8, cjs/react-dom-client.development.js
    // righe 19251-19270), React registra `wheel` come listener passivo, quindi
    // preventDefault verrebbe ignorato con un avviso in console — e la suite
    // pretende zero warning.
    /**
     * La rotella non ha un dito che si alza: la fine del gesto si deduce dal
     * silenzio. Senza questo, `data-gesto` resterebbe falso per tutta la
     * pizzicata da trackpad — che su desktop e la strada principale — e la
     * transizione ripartirebbe da capo a ogni evento, facendo inseguire
     * l'immagine con un ritardo permanente.
     */
    function marcaRaffica() {
      setInGesto(true)
      clearTimeout(fineRotella)
      fineRotella = setTimeout(() => {
        // Solo se nel frattempo non ci sono dita appoggiate: il silenzio della
        // rotella non dichiara finito un gesto di puntatore ancora in corso.
        if (puntatori.size === 0) setInGesto(false)
      }, FINE_ROTELLA_MS)
    }

    function rotella(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) {
        // Sui trackpad la pizzicata arriva proprio cosi, come rotella con
        // ctrlKey: gestendo questo caso il gesto sul trackpad si ha gratis.
        event.preventDefault()
        marcaRaffica()
        const fattore = Math.exp(-event.deltaY / SENSIBILITA_ROTELLA)
        // `perFattore`, non un livello assoluto composto qui: `zoomRef` viene
        // aggiornato da un effect, che React rimanda: due eventi consegnati
        // prima di quel flush leggerebbero lo stesso `livello` e il primo dei
        // due sparirebbe. Chi pizzica sul trackpad vedrebbe la fotografia
        // crescere meno di quanto ha chiesto, e proprio quando il thread e
        // occupato — cioe mentre decodifica il gradino appena scaricato.
        zoomRef.current.perFattore(fattore, relativo(event.clientX, event.clientY))
        return
      }
      // Rotella nuda: a riposo non e nostra, da ingranditi sposta.
      if (!zoomRef.current.ingrandito) return
      event.preventDefault()
      marcaRaffica()
      zoomRef.current.sposta({ x: -event.deltaX, y: -event.deltaY })
    }

    el.addEventListener('pointerdown', giu)
    el.addEventListener('pointermove', muovi)
    el.addEventListener('pointerup', su)
    el.addEventListener('pointercancel', su)
    el.addEventListener('wheel', rotella, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', giu)
      el.removeEventListener('pointermove', muovi)
      el.removeEventListener('pointerup', su)
      el.removeEventListener('pointercancel', su)
      el.removeEventListener('wheel', rotella)
      clearTimeout(fineRotella)
    }
    // Solo il ref: i valori freschi arrivano da zoomRef, e riagganciarsi a
    // ogni render romperebbe il gesto invece di aggiornarlo.
  }, [superficieRef])

  return { inGesto }
}
