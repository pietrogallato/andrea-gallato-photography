/**
 * Le fotografie di Andrea, in ordine di galleria.
 *
 * L'ordine dell'array **è** l'ordine pubblico: lo script scrive un orderRank
 * crescente seguendo questa sequenza. Riordinare qui e rieseguire NON cambia
 * l'ordine dei documenti già creati — dopo il primo caricamento l'ordine si
 * cambia trascinando dallo Studio, che è il posto giusto.
 *
 * `altIt` è obbligatorio e descrive ciò che si vede, non ciò che si intende:
 * è il testo che sente chi non può vedere la fotografia.
 *
 * `titleEn` porta i titoli dell'autore, presi dai nomi dei file così come
 * sono. Non c'è `titleIt`: sono titoli inglesi originali, non traduzioni da
 * fare. `pickLocalized` li serve anche sulle pagine italiane marcandoli
 * `lang="en"`, che è il trattamento corretto (WCAG 3.1.2).
 *
 * `year` viene dai metadati EXIF dei file, non da una stima.
 */
import type { PhotoSpec } from './photoDoc'

export const ANDREA_PHOTOS: PhotoSpec[] = [
  {
    filename: 'The Wall.jpg',
    titleEn: 'The Wall',
    altIt:
      'La sagoma di un bambino in bicicletta in un passaggio in ombra, incorniciata da un pilastro di mattoni rossi; oltre il passaggio, edifici in mattoni illuminati dal sole e una finestra ad arco.',
    altEn:
      'The silhouette of a child on a bicycle in a shaded passageway, framed by a red brick pillar; beyond it, sunlit brick buildings and an arched window.',
    year: 2026,
  },
  {
    filename: 'Last Train Home.jpg',
    titleEn: 'Last Train Home',
    altIt:
      'Una figura sola con giacca gialla e zaino percorre il corridoio deserto di una stazione sotterranea; lungo i parapetti di vetro corrono strisce di luce e in fondo si legge un cartello «Uscita».',
    altEn:
      'A lone figure in a yellow jacket with a backpack walks down the empty corridor of an underground station; strips of light run along the glass railings and an exit sign glows at the end.',
    year: 2026,
  },
  {
    filename: 'DSC_0098-4.jpg',
    altIt:
      'Di notte, i due dehors di un caffè ristorante chiusi da teli di plastica trasparente: sotto gli ombrelloni, ai tavoli con le tovaglie rosse, le persone cenano nella luce calda.',
    altEn:
      'At night, the two terraces of a café restaurant enclosed in clear plastic sheeting: under the umbrellas, at tables with red cloths, people are having dinner in warm light.',
    year: 2024,
  },
  {
    filename: 'Still here.jpg',
    titleEn: 'Still here',
    altIt:
      'Visto dall’interno buio di un sottoportico, un uomo in controluce sta fermo sulla soglia a testa bassa; oltre di lui una riva soleggiata, una barca ormeggiata e i passanti davanti alle botteghe.',
    altEn:
      'Seen from inside a dark passageway, a man stands still in the doorway, backlit, head lowered; beyond him a sunlit quayside, a moored boat and passers-by in front of the shops.',
    year: 2026,
  },
  {
    filename: 'Here and there.jpg',
    titleEn: 'Here and there',
    altIt:
      'Un uomo cammina lungo un muro portando sulle spalle una bambina vestita di giallo; accanto a loro la vetrina di un negozio con un grande ritratto maschile in bianco e nero, e nel vetro il loro riflesso.',
    altEn:
      'A man walks along a wall carrying a little girl dressed in yellow on his shoulders; beside them a shop window with a large black-and-white portrait of a man, and their reflection in the glass.',
    year: 2026,
  },
  {
    filename: 'DSC_5408-2.jpg',
    altIt:
      'Un uomo con gli occhiali legge il giornale seduto davanti a un chiosco di libri illuminato, circondato da scaffali pieni di volumi, locandine e cartelli scritti a mano.',
    altEn:
      'A man in glasses reads a newspaper, seated in front of a lit book stall surrounded by shelves full of volumes, posters and handwritten signs.',
    year: 2023,
  },
  {
    filename: 'Between Two Worlds.jpg',
    titleEn: 'Between Two Worlds',
    altIt:
      'Una donna in bicicletta passa davanti a una grande vetrata al crepuscolo; nel vetro si sovrappongono il blu della strada e l’arancio caldo dell’interno illuminato di un locale.',
    altEn:
      'A woman on a bicycle passes a large glass front at dusk; the blue of the street and the warm orange of a lit interior overlap in the glass.',
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
    filename: 'Above me.jpg',
    titleEn: 'Above me',
    altIt:
      'Inquadratura quasi interamente nera: in alto la sagoma della testa di un uomo contro un pannello blu e un finestrino; più in basso il volto di una donna con cappellino bianco, illuminato da una lama di sole.',
    altEn:
      'An almost entirely black frame: at the top the silhouette of a man’s head against a blue panel and a window; below, a woman’s face under a white cap, lit by a blade of sunlight.',
    year: 2026,
  },
  {
    filename: 'The night reader.jpg',
    titleEn: 'The night reader',
    altIt:
      'Di notte, vista dalla strada, una giovane donna con gli occhiali legge un libro seduta al tavolo di un locale illuminato; la luce calda attraversa la vetrina.',
    altEn:
      'At night, seen from the street, a young woman in glasses reads a book at a table inside a lit restaurant; warm light comes through the window.',
    year: 2025,
  },
  {
    filename: 'DSC_1088-6.jpg',
    altIt:
      'Controluce in una piazza: una donna con i capelli lunghi cammina verso l’obiettivo proiettando un’ombra lunghissima sul selciato chiaro; dietro di lei passano altre persone e un tram.',
    altEn:
      'Backlit in a square: a woman with long hair walks towards the camera, casting a very long shadow on the pale paving; behind her other people pass, and a tram.',
    year: 2026,
  },
  {
    filename: 'Passing Through.jpg',
    titleEn: 'Passing Through',
    altIt:
      'La sagoma di una persona che trascina un carrello attraversa una lama di sole fra due edifici in mattoni, proiettando un’ombra lunga sul selciato.',
    altEn:
      'The silhouette of a person pulling a shopping trolley crosses a blade of sunlight between two brick buildings, casting a long shadow on the pavement.',
    year: 2026,
  },
  {
    filename: 'Passing Through 1.jpg',
    titleEn: 'Passing Through',
    altIt:
      'La sagoma di un ciclista attraversa una parete ocra tagliata in diagonale dalla luce del sole; a destra una finestra con l’inferriata.',
    altEn:
      'The silhouette of a cyclist crosses an ochre wall cut diagonally by sunlight; to the right, a barred window.',
    year: 2026,
  },
  {
    filename: 'Passing Through 2.jpg',
    titleEn: 'Passing Through',
    altIt:
      'La sagoma di una persona con la borsa a tracolla cammina lungo un muro ocra illuminato di taglio, sotto una finestra con l’inferriata.',
    altEn:
      'The silhouette of a person with a shoulder bag walks along an ochre wall lit from the side, below a barred window.',
    year: 2026,
  },
  {
    filename: 'same wall 1.png',
    altIt:
      'Un uomo calvo in maglietta scura cammina lungo un grande muro grigio tagliato in diagonale dall’ombra.',
    altEn:
      'A bald man in a dark T-shirt walks along a large grey wall cut diagonally by shadow.',
    year: 2026,
  },
  {
    filename: 'same wall 2.png',
    altIt:
      'Un uomo con lo zaino e la camicia chiara cammina lungo lo stesso muro grigio, sul confine netto fra la luce e l’ombra.',
    altEn:
      'A man with a backpack and a light shirt walks along the same grey wall, on the sharp border between light and shadow.',
    year: 2026,
  },
  {
    filename: 'same wall 3.png',
    altIt:
      'Un uomo con un cappello di paglia chiaro e la borsa a tracolla cammina lungo il muro grigio; il volto resta in ombra sotto la tesa.',
    altEn:
      'A man in a light straw hat with a shoulder bag walks along the grey wall; his face stays in shadow under the brim.',
    year: 2026,
  },
  {
    filename: 'A day in the life.jpg',
    titleEn: 'A day in the life',
    altIt:
      'Interno di un mezzo pubblico: a sinistra una donna anziana con gli occhiali da sole alzati sui capelli e la cinghia della macchina fotografica al collo guarda verso la luce; a destra, sulla paratia verde, il riflesso di una giovane donna dai lunghi capelli ricci.',
    altEn:
      'Inside a public transport vehicle: on the left an older woman with sunglasses pushed up in her hair and a camera strap round her neck looks towards the light; on the right, on the green bulkhead, the reflection of a young woman with long curly hair.',
    year: 2026,
  },
  {
    filename: 'Not my table.png',
    titleEn: 'Not my table',
    altIt:
      'Davanti a un supermercato un uomo in divisa scura spinge una fila di carrelli; alle sue spalle un grande cartellone pubblicitario mostra due persone sedute a tavola, come se lui fosse il terzo commensale.',
    altEn:
      'Outside a supermarket a man in a dark uniform pushes a line of trolleys; behind him a large advertising panel shows two people seated at a table, as if he were the third guest.',
    year: 2026,
  },
  {
    filename: 'DSC_5439-4.jpg',
    altIt:
      'La sagoma nera di un uomo cammina davanti a una vetrina illuminata protetta da una grata a losanghe, con bottiglie e cartelli sullo sfondo dorato.',
    altEn:
      'The black silhouette of a man walks past a lit shop window protected by a diamond-pattern grille, with bottles and signs against the golden background.',
    year: 2023,
  },
]
