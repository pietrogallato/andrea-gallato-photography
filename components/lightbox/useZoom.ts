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

/**
 * Le due misure che servono, e servono entrambe.
 *
 * A riposo coincidono. Da ingranditi no: la cornice prende tutto lo schermo e
 * la fotografia dentro resta grande quanto il suo rapporto le concede. Il tetto
 * e la larghezza da chiedere al CDN parlano dei pixel dipinti, cioe della
 * fotografia; i limiti dello spostamento parlano di quanto la fotografia sborda
 * dalla cornice, quindi di tutte e due.
 */
type Misure = { fotografia: Riquadro; superficie: Riquadro }

export function useZoom({
  id,
  url,
  fotografiaRef,
  superficieRef,
  sizesDiRiposo,
}: {
  id: string
  url: string
  fotografiaRef: { current: HTMLElement | null }
  superficieRef: { current: HTMLElement | null }
  sizesDiRiposo: string
}) {
  const [vista, setVista] = useState<Vista>({ livello: 1, pan: { x: 0, y: 0 } })
  const [tetto, setTetto] = useState(MOLTIPLICATORE_MINIMO)
  const [sizes, setSizes] = useState(sizesDiRiposo)
  const [attesa, setAttesa] = useState(false)

  /** Il gradino piu grande gia ottenuto: non si torna mai indietro riducendo. */
  const massimoChiesto = useRef(0)

  const misura = useCallback((): Misure | null => {
    const uno = (el: HTMLElement | null): Riquadro | null => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      return { larghezza: r.width, altezza: r.height }
    }
    const fotografia = uno(fotografiaRef.current)
    const superficie = uno(superficieRef.current)
    if (!fotografia || !superficie) return null
    return { fotografia, superficie }
  }, [fotografiaRef, superficieRef])

  // Cambiando fotografia si torna a schermo intero. Senza, si arriverebbe
  // sulla successiva gia ingranditi in un punto che non ha senso per lei.
  useEffect(() => {
    setVista({ livello: 1, pan: { x: 0, y: 0 } })
    setSizes(sizesDiRiposo)
    setAttesa(false)
    massimoChiesto.current = 0
  }, [id, sizesDiRiposo])

  // Il tetto dipende da quanto grande viene dipinta la fotografia, e la misura
  // cambia sotto i piedi: la finestra si ridimensiona, ma soprattutto il
  // riquadro nasce a zero dentro un dialog chiuso e prende corpo solo quando
  // viene aperto. Nessun evento della finestra racconta quel momento, per
  // questo si guarda l'elemento e non `resize`: altrimenti la prima e unica
  // misura sarebbe quella degenere e il tetto resterebbe per sempre il minimo
  // di ripiego.
  useEffect(() => {
    function ricalcola() {
      const m = misura()
      const nuovoTetto = tettoDiIngrandimento({
        url,
        larghezzaDipintaCss: m?.fotografia.larghezza ?? 0,
        dpr: window.devicePixelRatio || 1,
      })
      setTetto(nuovoTetto)
      if (!m) return
      // Riquadri nuovi rimettono in discussione le due invarianti: il livello
      // puo essere rimasto sopra il tetto appena sceso, e lo spostamento fuori
      // dai bordi appena stretti. La vista uguale si restituisce identica,
      // perche un oggetto nuovo a ogni misura farebbe rendere all'infinito.
      setVista((v) => {
        const nuova = applica(v, v.livello, undefined, m, nuovoTetto)
        return nuova.livello === v.livello && nuova.pan.x === v.pan.x && nuova.pan.y === v.pan.y
          ? v
          : nuova
      })
    }
    ricalcola()
    // Tutti e due gli elementi sotto osservazione, non solo la fotografia: i
    // limiti dello spostamento dipendono dalla differenza fra i due riquadri, e
    // allargando soltanto la finestra in orizzontale la cornice cresce mentre
    // la fotografia — vincolata dall'altezza — resta identica. Osservando la
    // sola fotografia quel margine resterebbe quello di prima.
    const elementi = [fotografiaRef.current, superficieRef.current].filter(
      (el): el is HTMLElement => el !== null,
    )
    if (elementi.length === 0) return
    const osservatore = new ResizeObserver(ricalcola)
    elementi.forEach((el) => osservatore.observe(el))
    return () => osservatore.disconnect()
  }, [url, misura, fotografiaRef, superficieRef])

  /**
   * Il calcolo di una nuova vista, fuori da React perche non dipenda da nulla
   * che possa essere stantio.
   */
  function applica(
    v: Vista,
    richiesto: number,
    punto: Punto | undefined,
    m: Misure | null,
    limite: number,
  ): Vista {
    const livello = Math.min(Math.max(richiesto, 1), limite)
    if (!m) return { livello, pan: { x: 0, y: 0 } }
    const grezzo = punto
      ? spostamentoPerPuntoFisso({
          punto,
          livelloVecchio: v.livello,
          livelloNuovo: livello,
          panVecchio: v.pan,
        })
      : { x: (v.pan.x * livello) / v.livello, y: (v.pan.y * livello) / v.livello }
    return { livello, pan: limitaSpostamento({ pan: grezzo, livello, ...m }) }
  }

  const versoLivello = useCallback(
    (richiesto: number, punto?: Punto) => {
      const m = misura()
      setVista((v) => applica(v, richiesto, punto, m, tetto))
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
      const m = misura()
      setVista((v) => applica(v, v.livello * fattore, punto, m, tetto))
    },
    [misura, tetto],
  )

  const sposta = useCallback(
    (delta: Punto) => {
      const m = misura()
      setVista((v) => {
        if (!m) return v
        return {
          ...v,
          pan: limitaSpostamento({
            pan: { x: v.pan.x + delta.x, y: v.pan.y + delta.y },
            livello: v.livello,
            ...m,
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
      const m = misura()
      setVista((v) => applica(v, v.livello > 1 ? 1 : LIVELLO_DOPPIO_TOCCO, punto, m, tetto))
    },
    [misura, tetto],
  )

  // Il secondo scaricamento. Si precarica il gradino e si aspetta che sia
  // DECODIFICATO prima di alzare `sizes`: solo cosi il browser lo trova in
  // cache e cambia variante senza un istante di vuoto.
  useEffect(() => {
    if (vista.livello <= 1) return
    const m = misura()
    if (!m) return

    const dpr = window.devicePixelRatio || 1
    const larghezza = larghezzaDaChiedere({
      larghezzaDipintaCss: m.fotografia.larghezza,
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
        // Solo qui, e non nel `finally`: il srcset va alzato SE il gradino e
        // arrivato. Alzarlo dopo un fallimento manderebbe next/image a
        // chiedere dal srcset proprio la larghezza che ha appena fallito, e al
        // secondo errore SanityImage rimpiazza la fotografia con il riquadro
        // di ripiego. Chi guardava uno scatto ingrandito si troverebbe una
        // scatola di testo al suo posto.
        .then(() => {
          if (!vivo) return
          massimoChiesto.current = larghezza
          setSizes(sizesPerLivello({ larghezzaDipintaCss: m.fotografia.larghezza, livello: vista.livello }))
        })
        .catch(() => {
          // Un gradino che non arriva non e un guasto da mostrare: resta a
          // schermo la variante di prima, che e comunque leggibile.
        })
        .finally(() => {
          clearTimeout(barra)
          if (vivo) setAttesa(false)
        })
    }, RIPOSO_MS)

    return () => {
      vivo = false
      clearTimeout(avvio)
      clearTimeout(barra)
      // L'indicatore va spento qui e non solo nel `finally`: se si torna a
      // riposo mentre la decodifica e ancora in volo, quel `finally` arriva a
      // effetto gia morto e il ramo che spegne non viene percorso. Resterebbe
      // la rotella accesa sopra una fotografia ferma.
      setAttesa(false)
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
    perFattore,
    sposta,
    ingrandisci,
    riduci,
    azzera,
    alDoppioTocco,
  }
}
