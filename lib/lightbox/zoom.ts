import { WIDTH_LADDER, parseAssetDimensions, snapWidth } from '@/lib/sanity/imageUrl'

/**
 * Quanto si concede comunque, anche dove i pixel veri non ci sono.
 *
 * **Misura del 16 agosto 2026:** dodici delle ventiquattro fotografie del
 * dataset sono esportazioni 1080x1350. Su uno schermo retina la lightbox le
 * dipinge su circa 1116 pixel del dispositivo e ne riceve 1080: in pixel veri
 * il margine e sotto 1, quindi il criterio rigoroso avrebbe spento la funzione
 * su meta archivio. A 2x, 1080 pixel distesi su 1860 restano lontani dal
 * vedersi sgranati.
 *
 * Il rimedio vero e a monte: riesportando quelle dodici a lato lungo 3000-4000
 * px questo minimo smette di entrare in gioco da solo.
 */
export const MOLTIPLICATORE_MINIMO = 2

const LARGHEZZA_MASSIMA = WIDTH_LADDER[WIDTH_LADDER.length - 1]

export type Punto = { x: number; y: number }
export type Riquadro = { larghezza: number; altezza: number }

/**
 * Il tetto di quella fotografia: il maggiore fra i suoi pixel veri e il minimo
 * garantito.
 *
 * I pixel disponibili si leggono dalle dimensioni native nell'URL dell'asset,
 * **non** dal parametro `w=` ne da `snapWidth`: entrambi agganciano alla scala
 * delle larghezze e sovrastimerebbero il nativo fino a un gradino intero,
 * facendoci ingrandire oltre i pixel veri.
 *
 * Il conto va fatto in pixel del dispositivo. Su uno schermo retina la stessa
 * larghezza CSS ne consuma il doppio, ed e la ragione per cui il margine
 * apparente sparisce appena si guarda lo schermo giusto.
 */
export function tettoDiIngrandimento({
  url,
  larghezzaDipintaCss,
  dpr,
}: {
  url: string
  larghezzaDipintaCss: number
  dpr: number
}): number {
  const dipinta = larghezzaDipintaCss * dpr
  if (dipinta <= 0) return MOLTIPLICATORE_MINIMO

  const native = parseAssetDimensions(url)
  const disponibili = native ? Math.min(native.width, LARGHEZZA_MASSIMA) : LARGHEZZA_MASSIMA

  return Math.max(disponibili / dipinta, MOLTIPLICATORE_MINIMO)
}

function fra(valore: number, minimo: number, massimo: number): number {
  return Math.min(Math.max(valore, minimo), massimo)
}

/**
 * Tiene la fotografia attaccata ai bordi della cornice che la ritaglia.
 *
 * Senza questo vincolo si potrebbe trascinare l'immagine fuori scena e restare
 * a guardare lo sfondo, che e il modo piu rapido di far sembrare rotto un
 * visualizzatore.
 *
 * Due riquadri e non uno, perche non sono la stessa cosa: `cornice` e cio che
 * ritaglia — da ingranditi lo schermo intero — e `fotografia` e cio che viene
 * dipinto dentro, che con un rapporto diverso da quello dello schermo e piu
 * piccola. Il margine di manovra e quanto la fotografia ingrandita sborda dalla
 * cornice, per asse. Misurandolo sulla sola fotografia — `lato * (livello - 1)
 * / 2` — a 1440x900 e livello 1,6 su una quadrata dipinta 900x900 verrebbero
 * 270px in orizzontale dove la fotografia e larga esattamente quanto lo
 * schermo: 270px di sfondo trascinabili in scena, cioe proprio il difetto che
 * il vincolo dovrebbe impedire.
 *
 * Il massimo non scende mai sotto zero: finche la fotografia non riempie la
 * cornice non c'e nulla da spostare, e il nero attorno resta fermo.
 */
export function limitaSpostamento({
  pan,
  livello,
  fotografia,
  cornice,
}: {
  pan: Punto
  livello: number
  fotografia: Riquadro
  cornice: Riquadro
}): Punto {
  const massimoX = Math.max(0, (fotografia.larghezza * livello - cornice.larghezza) / 2)
  const massimoY = Math.max(0, (fotografia.altezza * livello - cornice.altezza) / 2)
  return {
    x: fra(pan.x, -massimoX, massimoX),
    y: fra(pan.y, -massimoY, massimoY),
  }
}

/**
 * Lo spostamento che tiene fermo un punto mentre il livello cambia.
 *
 * Senza, la fotografia si ingrandisce sempre verso il centro e chi voleva
 * guardare un angolo deve inseguirlo trascinando: e la differenza fra uno zoom
 * che si usa e uno che si combatte.
 *
 * `punto` e in coordinate del riquadro rispetto al suo centro.
 *
 * Il conto compone i soli livelli, e vale finche la scatola dipinta sotto la
 * trasformazione resta quella: fino al 2026-08-17 quella scatola cresceva
 * passando a tutto schermo, e l assunzione saltava proprio nel gesto piu
 * comune — la prima pizzicata — con 92,5px di scarto misurati a 1440x900.
 * Adesso la fotografia si dipinge alla stessa larghezza nei due stati, e il
 * confine non e piu un caso a parte. Resta un limite che nessun conto puo
 * togliere: finche la fotografia sta dentro la cornice, `limitaSpostamento` la
 * tiene centrata — a ragione, altrimenti entrerebbe lo sfondo — e li il punto
 * sotto il dito non puo restare fermo.
 */
export function spostamentoPerPuntoFisso({
  punto,
  livelloVecchio,
  livelloNuovo,
  panVecchio,
}: {
  punto: Punto
  livelloVecchio: number
  livelloNuovo: number
  panVecchio: Punto
}): Punto {
  const rapporto = livelloNuovo / livelloVecchio
  return {
    x: punto.x - (punto.x - panVecchio.x) * rapporto,
    y: punto.y - (punto.y - panVecchio.y) * rapporto,
  }
}

/** Dalle coordinate del puntatore a quelle del riquadro, con l'origine al centro. */
export function puntoRispettoAlCentro({
  cliente,
  rettangolo,
}: {
  cliente: Punto
  rettangolo: { left: number; top: number; larghezza: number; altezza: number }
}): Punto {
  return {
    x: cliente.x - (rettangolo.left + rettangolo.larghezza / 2),
    y: cliente.y - (rettangolo.top + rettangolo.altezza / 2),
  }
}

/**
 * La larghezza da chiedere al CDN per un dato livello, in pixel del
 * dispositivo, gia agganciata alla scala.
 *
 * Serve a costruire l'URL da precaricare, e quell'URL va costruita con lo
 * stesso loader che riempie il srcset — `sanityImageLoader` — non con
 * `buildImageUrl` chiamata a mano: il loader aggiunge la qualita tarata, e
 * senza quel parametro si precaricherebbe un altro file sotto un'altra chiave
 * di cache, cioe un precaricamento che non risparmia niente.
 *
 * Chiedere piu dei pixel disponibili non spreca banda: la larghezza viene
 * comunque limitata ai pixel nativi dell'asset e torna il file nativo.
 */
export function larghezzaDaChiedere({
  larghezzaDipintaCss,
  dpr,
  livello,
}: {
  larghezzaDipintaCss: number
  dpr: number
  livello: number
}): number {
  return snapWidth(larghezzaDipintaCss * dpr * livello)
}

/**
 * L'attributo `sizes` per un dato livello, in pixel CSS.
 *
 * Non e la stessa cosa di `larghezzaDaChiedere`: `sizes` e in pixel CSS perche
 * il browser lo moltiplica lui per il rapporto di pixel prima di scegliere la
 * variante nel srcset. Passare qui una larghezza in pixel del dispositivo
 * farebbe scaricare il doppio del necessario su ogni schermo retina.
 */
export function sizesPerLivello({
  larghezzaDipintaCss,
  livello,
}: {
  larghezzaDipintaCss: number
  livello: number
}): string {
  return `${Math.round(larghezzaDipintaCss * livello)}px`
}
