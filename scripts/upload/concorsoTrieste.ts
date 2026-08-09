import os from 'node:os'
import path from 'node:path'
import type { PhotoSpec } from './photoDoc'

/**
 * Il lotto del concorso di Trieste: cinque fotografie e il progetto che le
 * tiene insieme.
 *
 * «Wedding Day, Ordinary Street» e **la stessa fotografia** gia caricata fra
 * quelle di galleria — verificato identica byte per byte. Non viene ricaricata:
 * l'`_id` deriva dal nome del file, quindi il progetto riusa il documento che
 * c'e gia. E anche il motivo per cui resta visibile in galleria mentre le
 * altre quattro no.
 */
export const CONCORSO_TRIESTE_DIR =
  process.env.PROJECT_DIR ?? path.join(os.homedir(), 'Downloads', 'Concorso trieste')

/**
 * L'ordine dell'array e l'ordine in cui le fotografie si scorrono sulla
 * pagina del progetto. A colori prima, bianco e nero poi.
 */
export const CONCORSO_TRIESTE_PHOTOS: PhotoSpec[] = [
  {
    filename: 'Lessons in Affection.jpg',
    titleEn: 'Lessons in Affection',
    altIt:
      'All’angolo di un vicolo, sul muro giallo un graffito a stencil raffigura due figure stilizzate, una grande e una piccola, che si tengono per mano; oltre lo spigolo, sul marciapiede, una ragazza e un ragazzo camminano sorridendo.',
    altEn:
      'At the corner of an alley, a stencilled graffiti on the yellow wall shows two stick figures, one large and one small, holding hands; around the corner, on the pavement, a young woman and a young man walk along smiling.',
    year: 2026,
  },
  {
    filename: 'Crossing the Light.jpg',
    titleEn: 'Crossing the Light',
    altIt:
      'La sagoma di una persona con cappotto e borsa a tracolla cammina lungo un muro ocra illuminato di taglio dal sole; a sinistra una finestra alta con l’inferriata, a destra l’ombra netta di un edificio.',
    altEn:
      'The silhouette of a person in a coat with a shoulder bag walks along an ochre wall lit from the side by the sun; to the left a tall barred window, to the right the sharp shadow of a building.',
    year: 2026,
  },
  {
    filename: 'Wedding Day, Ordinary Street.jpg',
    titleEn: 'Wedding Day, Ordinary Street',
    altIt:
      'Inquadrati dall’apertura buia di un garage, uno sposo in giacca bianca porta in braccio la sposa attraversando una strada qualunque; in primo piano, in ombra, le automobili parcheggiate.',
    altEn:
      'Framed by the dark opening of a garage, a groom in a white jacket carries the bride across an ordinary street; in the foreground, in shadow, parked cars.',
    year: 2026,
  },
  {
    filename: 'Reflections of a Market .jpg',
    titleEn: 'Reflections of a Market',
    altIt:
      'Bianco e nero. Fra i banchi di un mercato dell’usato, un grande specchio con la cornice lavorata riflette una donna anziana con gli occhiali e una ragazza; accanto allo specchio un uomo con la barba guarda verso l’obiettivo, e intorno teste di manichino con i cappelli e stoffe appese.',
    altEn:
      'Black and white. Among the stalls of a second-hand market, a large mirror in an ornate frame reflects an older woman in glasses and a young woman; beside the mirror a bearded man looks towards the camera, surrounded by mannequin heads with hats and hanging fabrics.',
    year: 2026,
  },
  {
    filename: 'Under Her Gaze.JPG',
    titleEn: 'Under Her Gaze',
    altIt:
      'Bianco e nero. In un museo, un uomo anziano con gli occhiali e i capelli bianchi passa davanti a un grande dipinto rinascimentale; la giovane donna ritratta nel quadro tiene lo sguardo abbassato, e sembra guardare lui.',
    altEn:
      'Black and white. In a museum, an older man with glasses and white hair walks past a large Renaissance painting; the young woman portrayed in it keeps her eyes lowered, and seems to be looking at him.',
    year: 2026,
  },
]

/**
 * I dati del progetto.
 *
 * **Titolo e descrizione sono provvisori** e lo dicono. «Concorso Trieste» e
 * il nome della cartella, cioe un nome di lavoro, non un titolo d'autore; e
 * una descrizione di un progetto la scrive chi l'ha fatto, non io.
 *
 * Lo slug invece conviene sceglierlo adesso: e l'indirizzo della pagina, e
 * cambiarlo dopo che qualcuno l'ha condiviso rompe il collegamento.
 */
export const CONCORSO_TRIESTE_PROJECT = {
  id: 'project-concorso-trieste',
  slug: 'concorso-trieste',
  titleIt: 'Concorso Trieste',
  descriptionIt:
    'Testo provvisorio, da sostituire dallo Studio. Qui va la descrizione del progetto: che cosa tiene insieme queste cinque fotografie, dove e quando sono state fatte, e perche stanno una accanto all’altra.',
  descriptionEn:
    'Placeholder text, to be replaced from the Studio. This is where the project description goes: what holds these five photographs together, where and when they were taken, and why they belong side by side.',
  year: 2026,
  /** Legge bene anche in piccolo, nella scheda dell'indice dei progetti. */
  coverFilename: 'Lessons in Affection.jpg',
} as const
