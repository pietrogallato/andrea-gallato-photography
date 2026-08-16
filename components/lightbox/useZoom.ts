'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  larghezzaDaChiedere,
  limitaSpostamento,
  sizesPerLivello,
  spostamentoPerPuntoFisso,
  tettoDiIngrandimento,
  MOLTIPLICATORE_MINIMO,
  type Punto,
  type Riquadro,
} from '@/lib/lightbox/zoom'
import sanityImageLoader from '@/lib/sanity/imageUrl.loader'

/**
 * Quanto ingrandisce un colpo di `+` o del pulsante.
 *
 * 1,6 e un compromesso: con 2 si arriva al tetto in due colpi e la scala e
 * grossolana, con 1,2 servono otto pressioni per raddoppiare.
 */
const PASSO = 1.6

/** Dove porta il doppio tocco. E sempre raggiungibile: e anche il minimo garantito del tetto. */
const LIVELLO_DOPPIO_TOCCO = MOLTIPLICATORE_MINIMO

/**
 * Quanto si sta fermi prima di chiedere alla rete.
 *
 * Durante la pizzicata l'immagine si muove e la nitidezza non e giudicabile;
 * scaricare in quel momento ruberebbe banda e lavoro al gesto. Si aspetta che
 * il gesto sia finito.
 */
const RIPOSO_MS = 200

/** La stessa soglia dell'attesa gia esistente: sotto, l'indicatore lampeggerebbe. */
const INDICATORE_MS = 300

export type Vista = { livello: number; pan: Punto }

export function useZoom({
  id,
  url,
  riquadroRef,
  sizesDiRiposo,
}: {
  id: string
  url: string
  riquadroRef: { current: HTMLElement | null }
  sizesDiRiposo: string
}) {
  const [vista, setVista] = useState<Vista>({ livello: 1, pan: { x: 0, y: 0 } })
  const [tetto, setTetto] = useState(MOLTIPLICATORE_MINIMO)
  const [sizes, setSizes] = useState(sizesDiRiposo)
  const [attesa, setAttesa] = useState(false)

  /** Il gradino piu grande gia ottenuto: non si torna mai indietro riducendo. */
  const massimoChiesto = useRef(0)

  const misura = useCallback((): Riquadro | null => {
    const el = riquadroRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { larghezza: r.width, altezza: r.height }
  }, [riquadroRef])

  // Cambiando fotografia si torna a schermo intero. Senza, si arriverebbe
  // sulla successiva gia ingranditi in un punto che non ha senso per lei.
  useEffect(() => {
    setVista({ livello: 1, pan: { x: 0, y: 0 } })
    setSizes(sizesDiRiposo)
    setAttesa(false)
    massimoChiesto.current = 0
  }, [id, sizesDiRiposo])

  // Il tetto dipende da quanto grande viene dipinta la fotografia, che cambia
  // col ridimensionamento della finestra.
  useEffect(() => {
    function ricalcola() {
      const r = misura()
      setTetto(
        tettoDiIngrandimento({
          url,
          larghezzaDipintaCss: r?.larghezza ?? 0,
          dpr: window.devicePixelRatio || 1,
        }),
      )
    }
    ricalcola()
    window.addEventListener('resize', ricalcola)
    return () => window.removeEventListener('resize', ricalcola)
  }, [url, misura])

  /**
   * Il calcolo di una nuova vista, fuori da React perche non dipenda da nulla
   * che possa essere stantio.
   */
  function applica(
    v: Vista,
    richiesto: number,
    punto: Punto | undefined,
    riquadro: Riquadro | null,
    limite: number,
  ): Vista {
    const livello = Math.min(Math.max(richiesto, 1), limite)
    if (!riquadro) return { livello, pan: { x: 0, y: 0 } }
    const grezzo = punto
      ? spostamentoPerPuntoFisso({
          punto,
          livelloVecchio: v.livello,
          livelloNuovo: livello,
          panVecchio: v.pan,
        })
      : { x: (v.pan.x * livello) / v.livello, y: (v.pan.y * livello) / v.livello }
    return { livello, pan: limitaSpostamento({ pan: grezzo, livello, riquadro }) }
  }

  const versoLivello = useCallback(
    (richiesto: number, punto?: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, richiesto, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  /**
   * Ingrandire di un fattore, non verso un livello assoluto.
   *
   * La differenza non e stilistica: leggendo `vista.livello` dalla chiusura,
   * due pressioni ravvicinate partirebbero entrambe dallo stesso valore e la
   * seconda non avrebbe alcun effetto. Qui il livello di partenza arriva
   * dall'updater, quindi le pressioni si compongono.
   */
  const perFattore = useCallback(
    (fattore: number, punto?: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, v.livello * fattore, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  const sposta = useCallback(
    (delta: Punto) => {
      const riquadro = misura()
      setVista((v) => {
        if (!riquadro) return v
        return {
          ...v,
          pan: limitaSpostamento({
            pan: { x: v.pan.x + delta.x, y: v.pan.y + delta.y },
            livello: v.livello,
            riquadro,
          }),
        }
      })
    },
    [misura],
  )

  const ingrandisci = useCallback(() => perFattore(PASSO), [perFattore])
  const riduci = useCallback(() => perFattore(1 / PASSO), [perFattore])
  const azzera = useCallback(() => versoLivello(1), [versoLivello])
  const alDoppioTocco = useCallback(
    (punto: Punto) => {
      const riquadro = misura()
      setVista((v) => applica(v, v.livello > 1 ? 1 : LIVELLO_DOPPIO_TOCCO, punto, riquadro, tetto))
    },
    [misura, tetto],
  )

  // Il secondo scaricamento. Si precarica il gradino e si aspetta che sia
  // DECODIFICATO prima di alzare `sizes`: solo cosi il browser lo trova in
  // cache e cambia variante senza un istante di vuoto.
  useEffect(() => {
    if (vista.livello <= 1) return
    const riquadro = misura()
    if (!riquadro) return

    const dpr = window.devicePixelRatio || 1
    const larghezza = larghezzaDaChiedere({
      larghezzaDipintaCss: riquadro.larghezza,
      dpr,
      livello: vista.livello,
    })
    if (larghezza <= massimoChiesto.current) return

    let vivo = true
    let barra: ReturnType<typeof setTimeout> | undefined

    const avvio = setTimeout(() => {
      if (!vivo) return
      barra = setTimeout(() => { if (vivo) setAttesa(true) }, INDICATORE_MS)

      const img = new window.Image()
      // L'URL passa dallo stesso loader che riempie il srcset, non da
      // buildImageUrl a mano: il loader aggiunge la qualita tarata, e senza
      // quel parametro si precaricherebbe un file diverso sotto un'altra
      // chiave di cache. Il browser, alzato `sizes`, andrebbe comunque in rete
      // a prendere la variante buona — e il precaricamento avrebbe soltanto
      // raddoppiato i byte.
      img.src = sanityImageLoader({ src: url, width: larghezza })
      img
        .decode()
        .catch(() => {
          // Un gradino che non arriva non e un guasto da mostrare: resta a
          // schermo la variante di prima, che e comunque leggibile.
        })
        .finally(() => {
          clearTimeout(barra)
          if (!vivo) return
          massimoChiesto.current = larghezza
          setAttesa(false)
          setSizes(sizesPerLivello({ larghezzaDipintaCss: riquadro.larghezza, livello: vista.livello }))
        })
    }, RIPOSO_MS)

    return () => {
      vivo = false
      clearTimeout(avvio)
      clearTimeout(barra)
    }
  }, [vista.livello, url, misura])

  return {
    livello: vista.livello,
    pan: vista.pan,
    tetto,
    sizes,
    attesa,
    ingrandito: vista.livello > 1,
    alTetto: vista.livello >= tetto,
    versoLivello,
    sposta,
    ingrandisci,
    riduci,
    azzera,
    alDoppioTocco,
  }
}
