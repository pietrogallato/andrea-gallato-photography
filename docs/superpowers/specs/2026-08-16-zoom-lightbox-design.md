# Zoom nella lightbox — design

**Obiettivo.** Dentro la lightbox si può ingrandire una fotografia per studiarla da vicino e
spostarsi in ogni direzione, da telefono e da computer, senza ricorrere all'ingrandimento
della pagina.

**Documenti normativi.** [Specifica di prodotto §17.5](../../../portfolio-fotografico-design.md) ·
[design implementativo](2026-08-07-portfolio-fotografico-design.md)

**Stato di partenza, 16 agosto 2026.** La lightbox mostra la fotografia intera dentro lo
schermo e non ha alcun gestore di puntatore: niente swipe, niente rotella, niente doppio
clic. La navigazione è affidata ai pulsanti e alle frecce, per scelta documentata.
`Lightbox.module.css:44` dichiara `touch-action: pan-y pinch-zoom` sulla figura, cioè cede
la pizzicata al browser — ed è il motivo per cui oggi pizzicare ingrandisce la pagina invece
dello scatto.

---

## 1. Cosa può fare chi guarda

A riposo nulla cambia: fotografia intera, chiusura in alto a destra, frecce ai lati,
didascalia sotto. L'unica aggiunta è un pulsante per ingrandire, che è anche l'unico modo in
cui la funzione esiste per chi naviga da tastiera.

| | ingrandisce | sposta |
|---|---|---|
| telefono | pizzicata, doppio tocco | trascinamento |
| trackpad | pizzicata, doppio clic | trascinamento, due dita |
| mouse | Ctrl + rotella, doppio clic | trascinamento |
| tastiera | `+` e `−`, o i pulsanti | frecce |

La pizzicata sul trackpad non richiede codice suo: macOS e Windows la consegnano al browser
come evento `wheel` con `ctrlKey`, lo stesso del mouse.

Il doppio tocco è un interruttore, non una scala: porta a 2× mantenendo fermo il punto
toccato, e un secondo doppio tocco riporta a schermo intero. 2× è sempre raggiungibile,
perché è anche il minimo garantito del tetto (§2).

**Il perimetro della pizzicata.** Viene catturata solo sulla superficie della fotografia.
Sulla didascalia, sui pulsanti e sui margini resta quella del browser. È una deroga
consapevole alla scelta scritta nel design del 7 agosto, riga 396, che aveva ceduto la
pizzicata al browser proprio per WCAG 1.4.4: la deroga vale perché sulla fotografia
offriamo lo stesso servizio fatto meglio, e non vale altrove, dove non lo offriamo. Il meta
viewport non va toccato: `user-scalable=no` e `maximum-scale` restano proibiti su tutto il
sito, e `e2e/a11y.spec.ts` lo sorveglia.

**Il passaggio fra i due stati.** Superato lo schermo intero, frecce e didascalia si
ritirano; restano la chiusura e i due comandi, dove il secondo diventa «torna a schermo
intero». Le frecce della tastiera smettono di navigare e cominciano a spostare la vista.

Ritirare le frecce non è pulizia: è ciò che rende leggibile il cambio di significato dei
tasti. Lasciarle disegnate mentre la stessa freccia fa un'altra cosa sarebbe un'interfaccia
che contraddice la tastiera.

**`Esc` a due tempi.** Da ingranditi torna a schermo intero, e solo da lì chiude. Chi vuole
chiudere subito ha il pulsante, che in quello stato è visibile apposta.

**Cambio fotografia.** L'ingrandimento si azzera sempre: la successiva si apre intera.

---

## 2. Il tetto, e perché cambia da fotografia a fotografia

**Misura del 16 agosto 2026.** Delle 24 fotografie del dataset `production`, dodici sono
esportazioni 1080×1350; le altre dodici arrivano fino a 4000 px sul lato lungo.

Il tetto di ciascuna è **il maggiore fra i suoi pixel veri e un minimo garantito di 2×**.

La prima metà della regola evita di mostrare pixel inventati dove non serve: sulle dodici
grandi il margine reale è circa 4× e si arriva fin lì. La seconda metà esiste perché la
lettura rigorosa avrebbe cancellato la funzione su metà archivio, e per una ragione poco
intuitiva: il conto va fatto in pixel del dispositivo, non in pixel CSS.

Su un portatile retina la lightbox dipinge una fotografia verticale su circa 558 px CSS,
cioè ~1116 px del dispositivo, e riceve già l'intero file da 1080 px. **Misura del 16 agosto
2026:** chiedendo alla CDN `w=1280` o `w=2560` di un asset 1080×1350 tornano comunque
1080×1350, perché `fit=max` non ingrandisce. Il margine in pixel veri è quindi circa 1: zero.
Su iPhone è ancora più stretto. Con il solo criterio rigoroso il comando andrebbe spento su
dodici fotografie su ventiquattro.

Il minimo garantito di 2× costa poco in nitidezza — su uno schermo a tre volte, 1080 px
distesi su 1860 px del dispositivo restano lontani dal vedersi sgranati — e mantiene la
promessa che conta: non si vedono mai i pixel.

**Il rimedio vero è a monte.** Riesportando quelle dodici a lato lungo 3000–4000 px il
compromesso sparisce da sé e tutte arrivano al tetto pieno. Il codice non va toccato.

**Da dove si legge il nativo.** Da `parseAssetDimensions(photo.url)`, mai dal parametro `w=`
dell'URL né da `snapWidth`: entrambi agganciano alla scala delle larghezze e sovrastimano il
nativo fino a un gradino intero, facendoci superare i pixel veri. Il massimo scaricabile
resta comunque 3840 e non 4000, perché `WIDTH_LADDER` si ferma lì e `next.config.ts`
dichiara le stesse larghezze; `lib/sanity/__tests__/imageUrl.test.ts:13` asserisce che non
si esca dalla scala.

Al tetto il pulsante «ingrandisci» si disabilita. È così che ci si accorge di essere
arrivati, senza che nulla venga annunciato.

---

## 3. Il secondo scaricamento

La lightbox chiede alla CDN solo i pixel che le servono per riempire lo schermo
(`lib/lightbox/sizes.ts`). Ingrandire richiede quindi un file più grande.

**Quando.** Non durante il gesto: mentre si pizzica l'immagine si muove e la nitidezza non è
giudicabile, e la rete competerebbe col gesto. Appena ci si ferma, si guarda il livello
raggiunto e si chiede **quel** gradino, mai più di quello: chi ingrandisce poco non paga i
3840 px di chi è andato in fondo.

**Come, in tre tempi.**

1. si calcola il gradino della scala che serve al livello corrente;
2. lo si precarica in memoria e si attende che sia **decodificato**;
3. solo allora si alza il `sizes` dell'immagine già a schermo.

Il browser trova il file in cache e cambia candidato senza un istante di vuoto. La
fotografia che si sta guardando resta dipinta per tutto il tempo.

Perché questo funzioni, l'URL precaricata dev'essere **identica**, carattere per carattere, a
quella che il `srcset` chiederà: nasce quindi dallo stesso loader di `next/image`
(`sanityImageLoader`), non da una chiamata a mano a `buildImageUrl`. È il loader ad
aggiungere la qualità tarata (`q=80`), e un URL senza quel parametro è un file diverso sotto
un'altra chiave di cache: il browser andrebbe comunque in rete dopo aver alzato il `sizes`, e
il precarico avrebbe soltanto raddoppiato i byte.

Due cose che questo meccanismo **non** deve fare, entrambe già costate una regressione:

- **mai cambiare la `key`** dell'immagine. `SanityImage` porta `key={photo.url}` per
  rimontare l'elemento al cambio fotografia e riportare in scena il segnaposto sfocato; è
  voluto ed è sotto test. Applicato allo zoom produrrebbe l'opposto di quel che serve: la
  fotografia sparirebbe e tornerebbe il segnaposto, cioè il difetto segnalato in galleria;
- **mai riusare lo stato `loaded`** né il suo `role="progressbar"` né `aria-busy`. Quello
  stato dichiara la figura occupata; riusarlo annuncerebbe a chi ascolta che la fotografia
  non è disponibile mentre la sta guardando benissimo, e romperebbe i test della soglia dei
  300 ms.

**L'indicatore.** Una barra identica a vedersi a quella dell'attesa, guidata da uno stato
suo, con la stessa soglia di 300 ms — così su una connessione veloce non lampeggia mai — e
`aria-hidden`: in quel momento non si sta aspettando nulla, si sta per ricevere qualcosa di
meglio.

---

## 4. Dove vive lo stato, dove vive la matematica

**Lo stato** in un hook nuovo, `components/lightbox/useZoom.ts`: livello e spostamento su
due assi, azzerati nell'effect che già esiste su `photo.id`. Agganciato all'**id** e non
all'oggetto fotografia, perché in galleria l'array viene ricostruito a ogni render con un
`flatMap` e uno stato agganciato all'identità si azzererebbe da solo.

Il componente si smonta a ogni chiusura, quindi lo stato nasce e muore con l'apertura senza
bisogno di pulizia esplicita. Al cambio fotografia invece resta montato: è l'effect su
`photo.id` a doverlo azzerare, e senza di esso si arriverebbe sulla successiva già
ingranditi in un punto che non ha senso per quello scatto.

**La matematica** in un modulo puro, `lib/lightbox/zoom.ts`, accanto a `sizes.ts` e per la
stessa ragione. **Misurato su jsdom 30.0.1 installato:** `getBoundingClientRect` restituisce
tutti zeri, e non esistono `matchMedia`, `visualViewport`, `ResizeObserver` né
`setPointerCapture`. Attraverso il componente non è verificabile un solo conto; fuori sono
verificabili tutti:

- il tetto di quella fotografia, dai pixel nativi e dal minimo garantito;
- il vincolo dello spostamento, perché la fotografia non si stacchi dai bordi;
- il punto fisso: ingrandendo su un punto, quel punto resta dov'era;
- quale gradino della scala chiedere per un dato livello.

---

## 5. I tranelli del codice esistente

Tre cose che il codice fa già e che, ignorate, costano un pomeriggio a diagnosticare dal
comportamento.

**L'animazione d'entrata sequestra `transform`.** `.image` dichiara
`animation: reveal ... both`, e con `fill-mode: both` il valore animato resta in vigore
prima e dopo. **Misurato in Chromium 148:** su un elemento con `transform: scale(2)` inline
e quella stessa animazione, la computed transform è l'identità — lo `scale` non entra mai in
vigore. Uno zoom scritto lì sembrerebbe un errore di logica e sarebbe invece il CSS.

La trasformazione va quindi sull'`<img>` interno. Senza toccare `SanityImage`: livello e
spostamento si scrivono come tre variabili CSS sulla `<figure>`, e una regola in
`Lightbox.module.css` le applica all'immagine dentro. L'animazione d'entrata resta intatta,
il ritaglio è già garantito dall'`overflow: hidden` che il contenitore ha da sempre.

Le transizioni fra un livello e l'altro sono transizioni CSS, non animazioni JavaScript: è
l'unico modo perché `prefers-reduced-motion` le azzeri davvero, dato che la regola globale
agisce sul CSS e non fermerebbe un `requestAnimationFrame`.

**La rotella non può passare da `onWheel`.** **Verificato nel sorgente installato**
(`react-dom` 19.2.8, `cjs/react-dom-client.development.js:19251-19270`): React registra
`wheel`, `touchstart` e `touchmove` come listener passivi, quindi `preventDefault` verrebbe
ignorato con un avviso in console — e `e2e/console.dev.spec.ts` pretende zero warning.
Serve un `addEventListener` manuale con `{ passive: false }` in un effect, con la sua
pulizia.

**Le frecce non prendono un secondo listener.** Quello esistente vive su `document`
(`Lightbox.tsx:63-70`); aggiungerne un altro le farebbe agire due volte. Il ramo che decide
fra spostare e navigare va dentro quello. Lì dentro anche l'accortezza di non fare nulla con
Ctrl o Cmd premuto — quelli sono l'ingrandimento del browser, che WCAG 1.4.4 pretende resti
disponibile — e di accettare `=` oltre a `+`, perché su parecchi layout richiede Shift.

**`Esc` resta un evento `cancel`.** È annullabile, quindi il doppio stadio si ottiene con
`preventDefault()` quando si è ingranditi. Spostarlo su `close` o su un `keydown` proprio
farebbe tornare il lampo del doppio montaggio in sviluppo, documentato in `Lightbox.tsx:80-86`.
Tre e2e premono `Esc` una volta sola e pretendono la chiusura: continuano a passare, perché
girano a livello 1.

---

## 6. Cosa sentono gli screen reader

Nulla di nuovo, ed è una scelta.

C'è **una sola** regione live nella lightbox e annuncia la posizione. Aggiungerne una
seconda per il livello di ingrandimento romperebbe il test che la cerca con
`getByRole('status')` e, peggio, metterebbe due annunci in coda a ogni freccia: chi ascolta
si sentirebbe dire lo zoom quando voleva sapere a che fotografia è arrivato.

Lo stato lo dicono i comandi: «ingrandisci» si disabilita al tetto, «torna a schermo intero»
esiste solo da ingranditi.

La superficie della fotografia **non** diventa focalizzabile: eviterebbe una fermata muta
nel ciclo del Tab, e nella variante scartata era la fonte diretta di una violazione axe.

I nuovi comandi rispettano i 44 px di area minima come i tre esistenti, e le loro etichette
vanno in `it.ts` e `en.ts` insieme — un test verifica che le chiavi delle due lingue
coincidano esattamente.

---

## 7. Cosa cambia, file per file

| file | cosa |
|---|---|
| `lib/lightbox/zoom.ts` | **nuovo.** Tetto, vincolo dello spostamento, punto fisso, gradino da chiedere. Puro. |
| `lib/lightbox/__tests__/zoom.test.ts` | **nuovo.** Copre tutti e quattro i conti. |
| `components/lightbox/useZoom.ts` | **nuovo.** Stato, puntatori, rotella non passiva, precarico del gradino. |
| `components/lightbox/ZoomControls.tsx` | **nuovo.** I due pulsanti, con etichette dal dizionario. |
| `components/lightbox/Lightbox.tsx` | ramo delle frecce nell'effect esistente, `preventDefault` su `cancel`, variabili CSS sulla figura, ritiro di frecce e didascalia. |
| `components/lightbox/Lightbox.module.css` | regola sull'`<img>` interno, `touch-action: none` sulla sola superficie della fotografia, seconda barra. |
| `lib/i18n/dictionaries/{it,en}.ts` | tre chiavi nuove, in entrambe. |
| `docs/verifiche/protocolli-verifiche-manuali.md` | la pizzicata e il doppio tocco su un telefono vero. |

`SanityImage.tsx` non cambia.

---

## 8. Come si verifica

**Unitari.** Tutti i conti, nel modulo puro. Sul componente: presenza ed etichette dei
comandi, disabilitazione al tetto, ritiro di frecce e didascalia, e il ramo delle frecce —
raggiungibile perché il livello si alza anche col pulsante.

**End-to-end.** Tastiera, Ctrl + rotella e doppio clic si verificano davvero: `page.mouse` e
`page.keyboard` producono eventi autentici. Si aggiunge una passata axe con la lightbox
**ingrandita**, che oggi non esiste — la suite la controlla solo a riposo, ed è il buco che
avrebbe lasciato passare la soluzione scartata.

Un dettaglio che cambia come si scrivono le asserzioni: `e2e/fixtures.ts:36-50` intercetta
ogni richiesta a `cdn.sanity.io` e serve un JPEG 8×8, quindi `naturalWidth` vale 8 e non
dimostra nulla. La prova che si è arrivati al gradino giusto si costruisce sul parametro
`w=` della richiesta, che il fixture lascia intatto.

Va inoltre esteso `e2e/lightbox.spec.ts:82`, che oggi asserisce che il rettangolo
dell'`<img>` stia dentro il viewport: da ingranditi l'`<img>` è più grande del contenitore
per costruzione, quindi l'asserzione va spostata sul contenitore, che resta dentro.

**Manuale.** La pizzicata no. `Touchscreen` di Playwright emula solo il tap, il progetto
iPhone gira su WebKit e non c'è CDP a cui ripiegare. Finisce nel protocollo delle verifiche
manuali, accanto alla passata con screen reader — dichiarata, non taciuta.

---

## 9. Le due strade scartate, e perché

**Una libreria di lightbox completa (PhotoSwipe v5).** Non aggiunge lo zoom: sostituisce la
lightbox. La sua radice è un `<div role="dialog">` senza `aria-modal`, senza nome
accessibile e col fondo non inerte — cioè smonta le quattro cose che il `<dialog>` nativo ci
dà gratis. E la nostra suite axe non se ne accorgerebbe, perché `aria-dialog-name` porta il
tag best-practice e non `wcag2a`. Un difetto che passa i test e arriva in produzione è
peggio di uno che li rompe.

**Una libreria di solo zoom (react-zoom-pan-pinch v4).** `setTransform`, cioè la via
necessaria per la tastiera, non rispetta né `maxScale` né `minScale` né i limiti di
spostamento: **misurato**, accetta 5000 px dove il massimo è 936 e scala 25 dove il tetto è
3,4. Il tetto dai pixel nativi va quindi scritto a mano lo stesso, e resterebbe comprata
solo la pizzicata — pagando 12,6 kB gzip, tredici listener non passivi dentro la modale e
`prefers-reduced-motion` ignorato senza che alcun test lo veda.

**Lo spostamento affidato a un contenitore scorrevole**, che sarebbe stato più elegante del
trascinamento a mano, cade per due motivi indipendenti: per catturare la pizzicata dovrebbe
rinunciare allo scorrimento nativo che era la sua unica ragion d'essere, e un contenitore
scorrevole senza contenuto focalizzabile è una violazione axe di livello A
(`scrollable-region-focusable`) che la suite attuale non vedrebbe, perché nei test la
lightbox non viene mai ingrandita.

---

## 10. Fuori perimetro

- **Lo swipe per cambiare fotografia.** Resta escluso: i pulsanti sono l'alternativa
  dichiarata, e introdurlo ora creerebbe il conflitto col trascinamento che questo design
  non deve arbitrare.
- **La rotazione e il raddrizzamento.** Non servono a studiare uno scatto.
- **La riesportazione delle dodici fotografie a 1080 px.** È il rimedio vero al tetto basso,
  ma è lavoro di Andrea sui file, non lavoro sul codice.
- **La taratura della compressione**, ferma a 80 (`lib/sanity/imageUrl.loader.ts:30`) e già
  annotata come aperta nei criteri di accettazione: lo zoom la rende più visibile, ma è una
  misura sua.
