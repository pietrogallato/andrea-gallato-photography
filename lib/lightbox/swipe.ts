/**
 * Il trascinamento che cambia fotografia, ridotto a tre conti puri.
 *
 * Sta qui e non nell'hook per la stessa ragione di `zoom.ts`: dentro un
 * gestore di eventi queste regole sarebbero interrogabili solo muovendo dita
 * finte, mentre i casi che contano davvero — il bordo, lo scatto corto, la
 * diagonale — sono aritmetica e si guardano meglio da soli.
 *
 * Lo scarto non passa da `--pan-x` ne da `limitaSpostamento`: quelli
 * descrivono dove si e dentro una fotografia ingrandita, e sono limitati ai
 * bordi di quella fotografia. Lo scarto dello swipe e l'opposto — la
 * fotografia intera che scivola via — e a riposo `limitaSpostamento` lo
 * schiaccerebbe a zero, perche finche la fotografia sta dentro la cornice non
 * c'e nulla da spostare. Sono due grandezze diverse con lo stesso nome
 * apparente, e mescolarle spegnerebbe lo swipe senza un solo errore.
 */

export type Asse = 'orizzontale' | 'verticale' | 'indeciso'
export type Decisione = 'avanti' | 'indietro' | 'annulla'

/**
 * Quanto deve muoversi il dito prima che valga la pena dire in che verso va.
 *
 * Stesso valore e stessa ragione di TOCCO_FERMO_PX in useGestiZoom.ts: e la
 * tolleranza con cui i browser separano un tocco da un trascinamento (il touch
 * slop di Android e 8dp). Sotto c'e il tremolio del dito appoggiato, sopra c'e
 * un'intenzione. **Non misurata qui**: e presa da quella convenzione, non da
 * una prova su questo sito.
 *
 * **Provata a mano il 19 agosto 2026**, su un telefono vero, col protocollo §3:
 * il gesto risponde come atteso e la soglia non e stata corretta. Resta scelta
 * e non misurata — la prova dice che funziona, non che questo sia il valore
 * migliore possibile.
 */
export const IMPEGNO_PX = 10

/**
 * Quanta parte della fotografia va portata via perche il gesto valga.
 *
 * Una frazione e non un numero di pixel: la stessa fotografia e larga 380px sul
 * telefono e puo passare i 1000px su una scrivania, e una soglia fissa sarebbe
 * un colpetto la dove sul telefono e mezzo schermo.
 *
 * **Scelta il 2026-08-17, non misurata su utenti**: un quinto e il valore che
 * iOS e Android usano nei loro sfogliatori, e sui 380px del telefono fa 76px,
 * cioe circa mezzo pollice — abbastanza da non scattare per sbaglio mentre si
 * regge il telefono, poco abbastanza da non dover attraversare lo schermo.
 *
 * **Provata a mano il 19 agosto 2026**, su un telefono vero, col protocollo §3:
 * il gesto risponde come atteso e la soglia non e stata corretta. Resta scelta
 * e non misurata — la prova dice che funziona, non che questo sia il valore
 * migliore possibile.
 */
export const FRAZIONE_SOGLIA = 0.2

/**
 * La velocita che, da sola, vale un cambio di fotografia.
 *
 * Senza questo ramo lo swipe sembrerebbe rotto: sul telefono non si trascina
 * un quinto di schermo, si da un colpetto e si lascia. 0,5px/ms sono 500px al
 * secondo, cioe attraversare la fotografia del telefono in otto decimi di
 * secondo.
 *
 * **Soglia scelta il 2026-08-17, non misurata su dita vere**: nessuno qui ha
 * potuto registrare la velocita di un colpetto reale. Il ragionamento e che un
 * rilascio senza intenzione resta sotto i 200px/s, mentre un colpetto voluto li
 * supera comodamente; il margine fra i due e largo, quindi il valore esatto
 * conta poco.
 *
 * **Provata a mano il 19 agosto 2026**, su un telefono vero, col protocollo §3:
 * il gesto risponde come atteso e la soglia non e stata corretta. Resta scelta
 * e non misurata — la prova dice che funziona, non che questo sia il valore
 * migliore possibile.
 */
export const VELOCITA_SCATTO_PX_MS = 0.5

/**
 * Quanto deve comunque essere lungo uno scatto per contare.
 *
 * La sola velocita non basta: il rilascio di un tocco nervoso copre pochi pixel
 * in pochi millisecondi, e in rapporto e velocissimo. Tre volte l'impegno e il
 * punto in cui uno spostamento smette di poter essere un tocco storto.
 * **Scelto, non misurato** — vedi il §3 di
 * docs/verifiche/protocolli-verifiche-manuali.md, che dice da quale sintomo si
 * riconosce che e questa la soglia sbagliata.
 *
 * **Provata a mano il 19 agosto 2026**, su un telefono vero, col protocollo §3:
 * il gesto risponde come atteso e la soglia non e stata corretta. Resta scelta
 * e non misurata — la prova dice che funziona, non che questo sia il valore
 * migliore possibile.
 */
export const MINIMO_SCATTO_PX = 3 * IMPEGNO_PX

/**
 * Quanto cede il bordo, al massimo, in frazione di larghezza.
 *
 * Il bordo non e un muro: si piega e non si passa. E il modo con cui un
 * sfogliatore dice «di qua e finito» senza scrivere niente e senza spegnere
 * nulla. Un quarto e abbastanza da vedersi e poco da sembrare un cambio
 * riuscito a meta. **Scelto, non misurato** — vedi il §3 di
 * docs/verifiche/protocolli-verifiche-manuali.md, che dice da quale sintomo si
 * riconosce che e questa la soglia sbagliata.
 *
 * **Provata a mano il 19 agosto 2026**, su un telefono vero, col protocollo §3:
 * il gesto risponde come atteso e la soglia non e stata corretta. Resta scelta
 * e non misurata — la prova dice che funziona, non che questo sia il valore
 * migliore possibile.
 */
export const CEDIMENTO_AL_BORDO = 0.25

/**
 * In che verso sta andando il dito, o se e ancora presto per dirlo.
 *
 * Serve perche la superficie ha `touch-action: none`: nessun gesto viene piu
 * interpretato dal browser, quindi tocca a noi non far scivolare la fotografia
 * di lato quando il dito sta scendendo. L'asse si fissa una volta sola, al
 * primo momento in cui e leggibile, e non si rimette in discussione: un gesto
 * che cambia idea a meta e un gesto che trema.
 *
 * L'impegno si misura sull'ipotenusa e non sul singolo asse: nove pixel in
 * diagonale sono tredici di spostamento vero, cioe un dito che si e mosso.
 */
export function asseDelGesto({ dx, dy }: { dx: number; dy: number }): Asse {
  if (Math.hypot(dx, dy) < IMPEGNO_PX) return 'indeciso'
  // Maggiore stretto: la diagonale esatta non e un'intenzione orizzontale, e
  // far partire la fotografia di lato a 45 gradi la fa sembrare sfuggente.
  return Math.abs(dx) > Math.abs(dy) ? 'orizzontale' : 'verticale'
}

/**
 * Cosa fare quando il dito si alza.
 *
 * Due strade portano al cambio, e servono entrambe: la distanza, per chi
 * trascina piano guardando la fotografia scorrere, e la velocita, per chi da un
 * colpetto. Chi ne implementa una sola scontenta meta delle persone.
 *
 * `indice` e `quante` non sono un di piu passato per comodita: al bordo la
 * decisione non e «cambia» ma «annulla», e deciderlo qui invece che nel
 * chiamante e cio che tiene insieme il rimbalzo dello scarto e il verdetto del
 * rilascio.
 */
export function decisioneSwipe({
  dx,
  durataMs,
  larghezza,
  indice,
  quante,
}: {
  dx: number
  durataMs: number
  larghezza: number
  indice: number
  quante: number
}): Decisione {
  const percorso = Math.abs(dx)
  // Larghezza non ancora nota — il riquadro dentro un dialog appena aperto
  // misura zero — vorrebbe dire soglia zero, cioe qualunque pixel buono per
  // cambiare fotografia.
  if (larghezza <= 0) return 'annulla'

  const perDistanza = percorso >= larghezza * FRAZIONE_SOGLIA
  // `durataMs > 0` prima della divisione: due eventi possono portare lo stesso
  // timeStamp, e li la velocita sarebbe infinita e ogni rilascio cambierebbe
  // fotografia.
  const perVelocita =
    durataMs > 0 && percorso >= MINIMO_SCATTO_PX && percorso / durataMs >= VELOCITA_SCATTO_PX_MS

  if (!perDistanza && !perVelocita) return 'annulla'

  // Il dito porta via la fotografia verso sinistra: quella che entra da destra
  // e la successiva. E il verso di chi sfoglia, non quello di chi punta.
  if (dx < 0) return indice < quante - 1 ? 'avanti' : 'annulla'
  return indice > 0 ? 'indietro' : 'annulla'
}

/**
 * Di quanti pixel la fotografia segue il dito.
 *
 * In mezzo all'archivio lo segue esattamente: qualunque scarto fra dito e
 * fotografia si sente subito come scollamento. Al bordo invece cede sempre
 * meno, con un asintoto: `limite * s / (s + limite)` vale s quando s e piccolo
 * — quindi il freno entra senza scalino, e i primi pixel restano incollati al
 * dito — e non raggiunge mai `limite`, quindi il muro non si tocca ma si sente.
 *
 * Il freno vale in un verso solo. Sull'ultima fotografia il gesto che torna
 * indietro e legittimo, e frenarlo sarebbe punire un gesto giusto.
 */
export function scartoConResistenza({
  dx,
  larghezza,
  indice,
  quante,
}: {
  dx: number
  larghezza: number
  indice: number
  quante: number
}): number {
  if (larghezza <= 0) return 0

  const trattenuto = dx < 0 ? indice >= quante - 1 : indice <= 0
  if (!trattenuto) return dx

  const limite = larghezza * CEDIMENTO_AL_BORDO
  const percorso = Math.abs(dx)
  return Math.sign(dx) * ((limite * percorso) / (percorso + limite))
}
