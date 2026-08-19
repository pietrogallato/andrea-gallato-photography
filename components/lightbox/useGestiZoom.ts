'use client'

import { useEffect, useRef, useState } from 'react'
import { puntoRispettoAlCentro, type Punto } from '@/lib/lightbox/zoom'
import { asseDelGesto, decisioneSwipe, scartoConResistenza, type Asse } from '@/lib/lightbox/swipe'
import type { useZoom } from './useZoom'

/** Entro quanto tempo e quanto spazio due tocchi valgono per un doppio tocco. */
const DOPPIO_MS = 300
const DOPPIO_PX = 30

/**
 * Quanto puo scivolare un dito perche il suo rilascio conti ancora come tocco.
 *
 * Serve una soglia propria, piu stretta di DOPPIO_PX: dentro una fotografia
 * ingrandita si aggiusta l'inquadratura a colpetti brevi, e con 30px un
 * trascinamento da 20px passerebbe ancora per tocco — due colpetti di fila
 * varrebbero un doppio tocco e butterebbero via l'ingrandimento appena scelto,
 * che e il gesto piu frequente su telefono. 10px e la tolleranza che i browser
 * usano per distinguere un tocco da un trascinamento (il touch slop di Android
 * e 8dp): sotto ci sta il tremolio del dito, sopra c e un'intenzione.
 */
const TOCCO_FERMO_PX = 10

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

/**
 * Quanto indietro si guarda per misurare la velocita di un colpetto.
 *
 * La velocita non si puo leggere sull'intero gesto: in una lightbox si viene a
 * GUARDARE prima che a sfogliare, quindi il dito si appoggia, resta fermo, e
 * solo dopo da il colpetto. Quel tempo morto finirebbe al denominatore e
 * schiaccerebbe la media — **misurato il 2026-08-17** su build di produzione,
 * chromium, webkit e iPhone: lo stesso identico colpetto da 60px cambia
 * fotografia con pausa zero e non la cambia con 900ms di pausa, perche 60px su
 * 914ms fanno 0,065px/ms contro i 0,5 che decidono. La velocita e percio una
 * grandezza della CODA del gesto, mentre la distanza resta una grandezza del
 * gesto intero.
 *
 * **Provata a mano il 19 agosto 2026** su un telefono vero, col protocollo §3
 * passo 8: il colpetto corto viene raccolto, e la finestra non e stata corretta.
 *
 * **Scelta il 2026-08-17, non misurata su dita vere**: 100ms sono sei
 * fotogrammi a 60Hz, cioe abbastanza campioni perche la media non dipenda da
 * un singolo evento, e abbastanza pochi da non riprendere dentro il tempo in
 * cui il dito stava fermo a guardare.
 */
const CODA_MS = 100

/** Dove si e nell'archivio e come ci si sposta. Lo swipe non sa altro. */
export type Navigazione = { indice: number; quante: number; vai: (prossimo: number) => void }

export function useGestiZoom({
  superficieRef,
  zoom,
  navigazione,
}: {
  superficieRef: { current: HTMLElement | null }
  zoom: ReturnType<typeof useZoom>
  navigazione: Navigazione
}) {
  const [inGesto, setInGesto] = useState(false)
  /** Di quanti pixel la fotografia sta seguendo il dito, adesso. */
  const [scarto, setScarto] = useState(0)

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

  /**
   * La navigazione passa da un ref per la stessa ragione, e qui il prezzo di
   * sbagliare e piu alto: `indice` cambia a ogni fotografia sfogliata, quindi
   * metterlo fra le dipendenze rimonterebbe i listener proprio mentre si
   * sfoglia. Nessun test unitario lo vedrebbe — in jsdom il listener rimontato
   * funziona uguale — e sul telefono lo swipe si romperebbe al secondo gesto.
   */
  const navigazioneRef = useRef(navigazione)
  useEffect(() => {
    navigazioneRef.current = navigazione
  })

  /**
   * Come annullare lo sfogliare in corso stando fuori dall'effect.
   *
   * Il confine fra i due gesti di un dito solo e gia sorvegliato dentro
   * `muovi`, ma li si scopre solo all'evento successivo, e un evento
   * successivo puo non arrivare mai: l'ingrandimento si accende anche con un
   * tasto o col pulsante premuto dall'altra mano, e il dito puo restare fermo
   * dov'e. Lo scarto resterebbe congelato — la fotografia di traverso senza
   * che nessun dito la tenga — fino al prossimo movimento. Serve percio
   * accorgersene quando cambia lo stato, non solo quando si muove il dito.
   */
  const annullaSwipeRef = useRef<() => void>(() => {})

  useEffect(() => {
    const el = superficieRef.current
    if (!el) return

    const puntatori = new Map<number, Punto>()
    /**
     * Dove ogni dito ha toccato. `puntatori` insegue la posizione corrente e
     * quella di partenza si perde al primo movimento: senza ricordarla non si
     * puo sapere se il dito che si alza si era spostato, cioe se quel rilascio
     * chiude un tocco o un trascinamento.
     */
    const partenze = new Map<number, Punto>()
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
    /**
     * Lo sfogliare in corso, se c'e. Porta con se da dove e partito: la
     * distanza percorsa, che e uno dei due criteri del rilascio, si legge sul
     * gesto intero e non sull'ultimo spostamento, che e un pixel qualunque.
     * L'asse vive qui perche si fissa una volta sola, e un asse ricalcolato a
     * ogni movimento e un gesto che trema.
     */
    let swipe: { id: number; da: Punto; asse: Asse } | null = null
    /**
     * Dov'era il dito e quando, negli ultimi CODA_MS. E l'altro criterio del
     * rilascio — la velocita — e vuole una finestra recente invece del gesto
     * intero: il tempo passato col dito appoggiato fermo non e parte del
     * colpetto e non deve entrare nella media.
     */
    let coda: { x: number; tempo: number }[] = []
    /**
     * L'ingrandimento come i gestori l'hanno visto l'ultima volta.
     *
     * Il confine fra i due gesti che un dito solo puo fare — a riposo sfoglia,
     * da ingranditi sposta la vista — e sorvegliato a ogni evento, ma lo stato
     * del gesto sopravvivrebbe al passaggio da uno stato all'altro. Serve
     * quindi accorgersi del passaggio, non solo dello stato: e l'unica cosa
     * che l'evento in arrivo non racconta.
     */
    let ingranditoVisto = false
    let fineRotella: ReturnType<typeof setTimeout> | undefined

    /** La fotografia dipinta: la soglia dello swipe e una frazione di questa. */
    function larghezza(): number {
      return el!.getBoundingClientRect().width
    }

    /** Rimette la fotografia al suo posto e dimentica il gesto. */
    function annullaSwipe() {
      swipe = null
      coda = []
      setScarto(0)
    }
    annullaSwipeRef.current = annullaSwipe

    /**
     * Butta i campioni piu vecchi della finestra, tenendone sempre almeno uno.
     *
     * Almeno uno perche la coda serve a rispondere «quanto ha percorso il dito
     * di recente»: rimasti a zero campioni non ci sarebbe risposta, e la
     * risposta giusta per un dito fermo da un secondo e «niente», non
     * «infinito».
     */
    function potaCoda(ora: number) {
      while (coda.length > 1 && ora - coda[0].tempo > CODA_MS) coda.shift()
    }

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

    /**
     * Fissa la coppia di dita da cui si misura la pizzicata.
     *
     * Va rifatto ogni volta che le dita sullo schermo tornano a essere due, non
     * solo quando il secondo dito scende: con un terzo dito appoggiato per
     * sbaglio — il mignolo, il pollice della mano che regge — e poi uno dei due
     * originali che si alza, la coppia e un'altra ma la distanza di partenza
     * sarebbe rimasta quella di prima. Il primo micromovimento la
     * confronterebbe con una base che non c'entra piu, e chi guarda un
     * dettaglio a 2x si vedrebbe tornare la fotografia a schermo intero senza
     * aver chiesto nulla.
     */
    function agganciaCoppia() {
      distanzaIniziale = distanza()
      livelloIniziale = zoomRef.current.livello
      ultimo = null
      pizzicata = true
    }

    function giu(event: PointerEvent) {
      // Senza questo, col mouse il trascinamento muore dopo il primo
      // spostamento: l `<img>` fa partire il trascinamento nativo del browser
      // — quello che stacca l anteprima dell immagine dal puntatore per
      // portarla altrove — e il browser chiude il nostro gesto con un
      // `pointercancel`. **Misurato il 2026-08-17** a 1440x900: sei
      // spostamenti da 30px muovevano la fotografia di 30 e non di 180, e la
      // spia sugli eventi registrava pointerdown, pointermove, dragstart,
      // pointercancel.
      //
      // preventDefault sul pointerdown e non `draggable={false}`
      // sull immagine: quell attributo vive in SanityImage, che disegna anche
      // le fotografie della galleria, dove il trascinamento nativo non da
      // fastidio a nessuno. Qui il rimedio resta dentro la superficie della
      // lightbox, cioe dentro il perimetro dove i gesti sono nostri.
      event.preventDefault()
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })
      partenze.set(event.pointerId, { x: event.clientX, y: event.clientY })
      el!.setPointerCapture(event.pointerId)

      if (puntatori.size === 2) {
        agganciaCoppia()
        // Due dita sono una pizzicata, non uno sfogliare. Chi comincia ad
        // appoggiare la mano con un dito appena prima dell'altro si
        // ritroverebbe sulla fotografia dopo invece che sulla stessa,
        // ingrandita.
        annullaSwipe()
      } else if (puntatori.size === 1) {
        ultimo = { x: event.clientX, y: event.clientY }
        ingranditoVisto = zoomRef.current.ingrandito
        // Il gesto si registra sempre, anche da ingranditi: li non produrra
        // nulla, perche l'asse non viene mai fissato. Decidere adesso quale
        // dei due gesti sia sarebbe decidere sul dito appena sceso, che non ha
        // ancora detto niente.
        swipe = {
          id: event.pointerId,
          da: { x: event.clientX, y: event.clientY },
          asse: 'indeciso',
        }
        coda = [{ x: event.clientX, tempo: event.timeStamp }]
      }
      setInGesto(true)
    }

    function muovi(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return
      puntatori.set(event.pointerId, { x: event.clientX, y: event.clientY })

      // L'ingrandimento puo cambiare A META GESTO — Esc o `0` col dito ancora
      // giu, il pulsante premuto con l'altra mano, il gesto di sistema che fa
      // scattare onCancel del dialog — e i due gesti che un dito solo puo fare
      // sono l'uno l'opposto dell'altro. Guardare lo stato a ogni evento non
      // basta: e il gesto in corso a sopravvivere al passaggio. Un
      // trascinamento fatto da ingranditi, riletto dall'origine come uno
      // sfogliare, e gia oltre soglia — due pixel di dito, duecento di salto,
      // e la fotografia cambia da sola. Il gesto in corso si chiude qui, e la
      // posizione di adesso diventa la nuova base perche il dito che resta giu
      // non si porti dietro il passato.
      const ingrandito = zoomRef.current.ingrandito
      if (ingrandito !== ingranditoVisto) {
        ingranditoVisto = ingrandito
        // Solo con un dito solo: durante una pizzicata l'ingrandimento cambia
        // di continuo per mestiere, e li non c'e nessun confine da sorvegliare
        // — lo swipe e gia stato annullato dal secondo dito.
        if (puntatori.size === 1) {
          annullaSwipe()
          ultimo = { x: event.clientX, y: event.clientY }
        }
      }

      if (puntatori.size === 2 && distanzaIniziale > 0) {
        zoomRef.current.versoLivello((livelloIniziale * distanza()) / distanzaIniziale, centro())
        return
      }

      if (puntatori.size === 1 && ultimo && zoomRef.current.ingrandito) {
        zoomRef.current.sposta({ x: event.clientX - ultimo.x, y: event.clientY - ultimo.y })
        ultimo = { x: event.clientX, y: event.clientY }
        return
      }

      // Lo stesso trascinamento, a riposo, sfoglia: e il criterio che le frecce
      // della tastiera applicano gia. I due stati sono visibilmente diversi —
      // a riposo la fotografia sta tutta dentro lo schermo — quindi lo stesso
      // gesto non risulta ambiguo a chi lo fa.
      if (puntatori.size === 1 && swipe && swipe.id === event.pointerId) {
        coda.push({ x: event.clientX, tempo: event.timeStamp })
        potaCoda(event.timeStamp)
        const dx = event.clientX - swipe.da.x
        const dy = event.clientY - swipe.da.y
        // Una volta sola: dal momento in cui l'asse e leggibile in poi il gesto
        // non cambia piu mestiere, anche se la mano ruota attorno al polso.
        if (swipe.asse === 'indeciso') swipe.asse = asseDelGesto({ dx, dy })
        if (swipe.asse !== 'orizzontale') return
        const { indice, quante } = navigazioneRef.current
        setScarto(scartoConResistenza({ dx, larghezza: larghezza(), indice, quante }))
      }
    }

    function su(event: PointerEvent) {
      if (!puntatori.has(event.pointerId)) return

      // `pointercancel` dice l'opposto di `pointerup`: che il gesto NON e stato
      // compiuto, perche il sistema se l'e preso. E il momento di annullare e
      // far rimbalzare la fotografia, non di deciderla. Sul telefono il caso
      // vero e lo swipe che parte vicino al bordo dello schermo: il gesto di
      // ritorno del sistema lo intercetta, e chi lo fa si ritroverebbe la
      // pagina precedente E la fotografia cambiata sotto.
      const annullato = event.type === 'pointercancel'

      // Il dito si alza: lo sfogliare o si compie o torna indietro. Il verdetto
      // si legge sul gesto intero, ed e per questo che la partenza va ricordata.
      const sfogliava = swipe
      swipe = null
      if (
        !annullato &&
        sfogliava &&
        sfogliava.id === event.pointerId &&
        sfogliava.asse === 'orizzontale' &&
        // Anche qui, e non solo a ogni movimento: fra l'ultimo spostamento e il
        // rilascio ci sta un ingrandimento — un tasto, un pulsante — e da
        // ingranditi il trascinamento sposta la vista, non sfoglia.
        !zoomRef.current.ingrandito
      ) {
        const { indice, quante, vai } = navigazioneRef.current
        const dipinta = larghezza()
        potaCoda(event.timeStamp)
        const inizioCoda = coda[0] ?? { x: event.clientX, tempo: event.timeStamp }
        // Due domande diverse alla stessa funzione, perche i due criteri
        // vogliono due grandezze diverse. La DISTANZA e del gesto intero: chi
        // trascina piano guardando la fotografia scorrere ha percorso tutto
        // quello che ha percorso, e ogni pixel conta. La VELOCITA e solo della
        // coda: il tempo passato col dito appoggiato fermo — che in una
        // lightbox e la norma, perche ci si viene a guardare prima che a
        // sfogliare — non e parte del colpetto, e al denominatore
        // schiaccerebbe la media fino a farlo sparire.
        //
        // `durataMs: 0` spegne per costruzione il ramo della velocita: dentro
        // decisioneSwipe la divisione e protetta da `durataMs > 0`. La prima
        // chiamata e percio il solo criterio della distanza, la seconda porta
        // la coda con se. La regola resta una sola e sta li: qui si sceglie
        // soltanto con quali numeri interrogarla.
        const perDistanza = decisioneSwipe({
          dx: event.clientX - sfogliava.da.x,
          durataMs: 0,
          larghezza: dipinta,
          indice,
          quante,
        })
        const perScatto = decisioneSwipe({
          dx: event.clientX - inizioCoda.x,
          durataMs: event.timeStamp - inizioCoda.tempo,
          larghezza: dipinta,
          indice,
          quante,
        })
        const decisione = perDistanza !== 'annulla' ? perDistanza : perScatto
        if (decisione === 'avanti') vai(indice + 1)
        else if (decisione === 'indietro') vai(indice - 1)
      }
      coda = []
      // Sempre, non solo quando si annulla: cambiando fotografia la successiva
      // entrerebbe gia di traverso, spostata di quanto era arrivato il dito.
      // Con `data-gesto` che qui torna falso, questo zero e anche il ritorno
      // elastico, ed e una transizione CSS proprio perche chi ha chiesto meno
      // movimento possa fermarla.
      setScarto(0)

      // Doppio tocco, riconosciuto a mano invece che con `dblclick`: con
      // touch-action `none` il doppio tocco non e garantito arrivare come
      // dblclick su tutti i motori, e cosi mouse e dito seguono la stessa
      // strada, che e anche l unica che Playwright sa esercitare.
      const ora = event.timeStamp
      const vicino =
        Math.abs(event.clientX - ultimoTocco.x) < DOPPIO_PX &&
        Math.abs(event.clientY - ultimoTocco.y) < DOPPIO_PX
      const partenza = partenze.get(event.pointerId)
      partenze.delete(event.pointerId)
      // Un trascinamento non e un tocco. Il confronto e fra dove il dito e
      // sceso e dove si alza, non fra due rilasci: guardando solo i rilasci,
      // due aggiustamenti dell'inquadratura finiscono vicini e ravvicinati nel
      // tempo, ed e esattamente la firma di un doppio tocco.
      const trascinato =
        !partenza ||
        Math.abs(event.clientX - partenza.x) >= TOCCO_FERMO_PX ||
        Math.abs(event.clientY - partenza.y) >= TOCCO_FERMO_PX
      if (pizzicata || trascinato) {
        // Ne le dita che si alzano dopo una pizzicata ne quelle che hanno
        // trascinato sono tocchi. E non basta ignorarle: vanno anche
        // dimenticate, altrimenti resterebbero buone come primo tempo di un
        // doppio tocco con il rilascio successivo.
        ultimoTocco = { tempo: 0, x: 0, y: 0 }
      } else if (puntatori.size === 1 && ora - ultimoTocco.tempo < DOPPIO_MS && vicino) {
        zoomRef.current.alDoppioTocco(relativo(event.clientX, event.clientY))
        ultimoTocco = { tempo: 0, x: 0, y: 0 }
      } else {
        ultimoTocco = { tempo: ora, x: event.clientX, y: event.clientY }
      }

      puntatori.delete(event.pointerId)
      el!.releasePointerCapture(event.pointerId)
      // Scendendo da tre dita a due la pizzicata continua, ma fra due dita
      // diverse: la base va rifatta qui, o resterebbe quella della coppia che
      // non esiste piu.
      if (puntatori.size === 2) agganciaCoppia()
      else if (puntatori.size < 2) distanzaIniziale = 0
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

  // L'ingrandimento che cambia chiude lo sfogliare in corso, in tutti e due i
  // versi. Acceso: il gesto era uno sfogliare e da qui in poi sposterebbe la
  // vista. Spento — Esc col dito ancora giu, che per scelta dichiarata torna a
  // schermo intero invece di chiudere: il gesto era uno spostamento e riletto
  // dall'origine sarebbe gia oltre soglia, due pixel di dito e la fotografia
  // cambia da sola. In entrambi i casi il gesto in corso non ha piu un
  // significato, e la fotografia torna dritta.
  useEffect(() => {
    annullaSwipeRef.current()
  }, [zoom.ingrandito])

  return { inGesto, scarto }
}
