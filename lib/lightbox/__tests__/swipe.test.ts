import { describe, it, expect } from 'vitest'
import {
  asseDelGesto,
  decisioneSwipe,
  scartoConResistenza,
  CEDIMENTO_AL_BORDO,
  FRAZIONE_SOGLIA,
  IMPEGNO_PX,
  MINIMO_SCATTO_PX,
  VELOCITA_SCATTO_PX_MS,
} from '../swipe'

/** La fotografia sul telefono: 380px dipinti su uno schermo da 412. */
const LARGHEZZA = 380
const SOGLIA = LARGHEZZA * FRAZIONE_SOGLIA

describe('asseDelGesto', () => {
  it('sotto l impegno non si pronuncia', () => {
    // Il dito appena sceso trema di qualche pixel. Pronunciarsi li vorrebbe
    // dire decidere l asse del gesto sul rumore invece che sull intenzione.
    expect(asseDelGesto({ dx: IMPEGNO_PX - 1, dy: 0 })).toBe('indeciso')
    expect(asseDelGesto({ dx: 0, dy: IMPEGNO_PX - 1 })).toBe('indeciso')
  })

  it('un gesto piu largo che alto e orizzontale', () => {
    expect(asseDelGesto({ dx: -40, dy: 12 })).toBe('orizzontale')
  })

  it('un gesto piu alto che largo e verticale', () => {
    // Qui la fotografia non deve scorrere di lato: chi scende con il dito non
    // sta chiedendo la fotografia successiva.
    expect(asseDelGesto({ dx: 12, dy: -40 })).toBe('verticale')
  })

  it('la diagonale esatta non conta come orizzontale', () => {
    // A 45 gradi l intenzione non c e: il verso lo decide il pixel successivo.
    // Meglio che la fotografia resti ferma piuttosto che parta di lato.
    expect(asseDelGesto({ dx: 40, dy: 40 })).toBe('verticale')
  })

  it('l impegno si misura sul lato piu lungo, non su un asse solo', () => {
    // Nove pixel per asse, ma tredici di spostamento vero: il dito si e mosso.
    expect(asseDelGesto({ dx: 9, dy: 9 })).not.toBe('indeciso')
  })
})

describe('decisioneSwipe', () => {
  const lento = { durataMs: 2000, larghezza: LARGHEZZA, indice: 5, quante: 24 }

  it('oltre la soglia verso sinistra si va avanti', () => {
    // Il dito porta via la fotografia verso sinistra: quella che entra e la
    // successiva, come sfogliando.
    expect(decisioneSwipe({ dx: -SOGLIA, ...lento })).toBe('avanti')
  })

  it('oltre la soglia verso destra si torna indietro', () => {
    expect(decisioneSwipe({ dx: SOGLIA, ...lento })).toBe('indietro')
  })

  it('sotto la soglia e senza slancio non succede nulla', () => {
    expect(decisioneSwipe({ dx: -SOGLIA + 1, ...lento })).toBe('annulla')
  })

  it('uno scatto corto ma veloce vale un cambio', () => {
    // E il gesto vero sul telefono: non si trascina mai un quinto di schermo,
    // si da un colpetto. Senza questo ramo lo swipe sembrerebbe non funzionare.
    const dx = -(MINIMO_SCATTO_PX + 10)
    const durataMs = Math.abs(dx) / (VELOCITA_SCATTO_PX_MS * 2)
    expect(decisioneSwipe({ dx, durataMs, larghezza: LARGHEZZA, indice: 5, quante: 24 })).toBe('avanti')
  })

  it('uno scatto veloce ma cortissimo non vale nulla', () => {
    // Il rilascio di un tocco nervoso e velocissimo e lungo pochi pixel: se
    // bastasse la velocita, ogni tocco cambierebbe fotografia.
    const dx = -(MINIMO_SCATTO_PX - 1)
    expect(decisioneSwipe({ dx, durataMs: 5, larghezza: LARGHEZZA, indice: 5, quante: 24 })).toBe('annulla')
  })

  it('uno scatto lungo ma lento non vale nulla', () => {
    const dx = -(MINIMO_SCATTO_PX + 10)
    const durataMs = Math.abs(dx) / (VELOCITA_SCATTO_PX_MS / 2)
    expect(decisioneSwipe({ dx, durataMs, larghezza: LARGHEZZA, indice: 5, quante: 24 })).toBe('annulla')
  })

  it('sull ultima fotografia non si va avanti', () => {
    expect(decisioneSwipe({ dx: -LARGHEZZA, ...lento, indice: 23, quante: 24 })).toBe('annulla')
  })

  it('sulla prima fotografia non si torna indietro', () => {
    expect(decisioneSwipe({ dx: LARGHEZZA, ...lento, indice: 0, quante: 24 })).toBe('annulla')
  })

  it('sull ultima si torna comunque indietro', () => {
    // Il bordo trattiene un verso solo: l altro resta libero.
    expect(decisioneSwipe({ dx: SOGLIA, ...lento, indice: 23, quante: 24 })).toBe('indietro')
  })

  it('una durata nulla non fa esplodere il conto della velocita', () => {
    // Due eventi nello stesso millisecondo esistono: un timeStamp identico
    // darebbe una divisione per zero, cioe velocita infinita, e qualunque
    // rilascio cambierebbe fotografia.
    const d = decisioneSwipe({ dx: -1, durataMs: 0, larghezza: LARGHEZZA, indice: 5, quante: 24 })
    expect(d).toBe('annulla')
  })

  it('con una larghezza nulla non naviga per sbaglio', () => {
    // Il riquadro puo essere ancora degenere: con soglia zero qualunque
    // spostamento la supererebbe.
    expect(decisioneSwipe({ dx: -2, durataMs: 2000, larghezza: 0, indice: 5, quante: 24 })).toBe('annulla')
  })
})

describe('scartoConResistenza', () => {
  const mezzo = { larghezza: LARGHEZZA, indice: 5, quante: 24 }

  it('in mezzo all archivio la fotografia segue il dito', () => {
    expect(scartoConResistenza({ dx: -120, ...mezzo })).toBe(-120)
  })

  it('al bordo la fotografia resta indietro rispetto al dito', () => {
    // Il freno e cio che dice, senza parole ne pulsanti spenti, che di la non
    // c e piu niente.
    const s = scartoConResistenza({ dx: -120, larghezza: LARGHEZZA, indice: 23, quante: 24 })
    expect(s).toBeLessThan(0)
    expect(Math.abs(s)).toBeLessThan(120)
  })

  it('al bordo il cedimento ha un tetto che nessun trascinamento supera', () => {
    const tetto = LARGHEZZA * CEDIMENTO_AL_BORDO
    const s = scartoConResistenza({ dx: -100000, larghezza: LARGHEZZA, indice: 23, quante: 24 })
    expect(Math.abs(s)).toBeLessThan(tetto)
    expect(Math.abs(s)).toBeGreaterThan(tetto * 0.9)
  })

  it('al bordo, tirando verso l interno, il freno non c e', () => {
    // Sull ultima fotografia il verso che torna indietro e legittimo: frenarlo
    // sarebbe punire un gesto giusto.
    expect(scartoConResistenza({ dx: 120, larghezza: LARGHEZZA, indice: 23, quante: 24 })).toBe(120)
    expect(scartoConResistenza({ dx: -120, larghezza: LARGHEZZA, indice: 0, quante: 24 })).toBe(-120)
  })

  it('il freno entra senza scalino', () => {
    // Ai primi pixel il dito e la fotografia devono coincidere, o il gesto
    // partirebbe con uno strappo.
    const s = scartoConResistenza({ dx: -2, larghezza: LARGHEZZA, indice: 0, quante: 24 })
    expect(s).toBeCloseTo(-2, 1)
  })

  it('con una sola fotografia si e al bordo da tutte e due le parti', () => {
    expect(Math.abs(scartoConResistenza({ dx: -120, larghezza: LARGHEZZA, indice: 0, quante: 1 }))).toBeLessThan(120)
    expect(Math.abs(scartoConResistenza({ dx: 120, larghezza: LARGHEZZA, indice: 0, quante: 1 }))).toBeLessThan(120)
  })

  it('con una larghezza nulla non produce un valore assurdo', () => {
    expect(scartoConResistenza({ dx: -120, larghezza: 0, indice: 0, quante: 24 })).toBe(0)
  })
})
