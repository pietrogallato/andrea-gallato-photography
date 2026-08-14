# Home statica — design

**Obiettivo.** La home diventa una sola schermata: la fotografia di apertura riempie lo
schermo e la pagina non scorre. Chi arriva vede uno scatto, il nome, una riga di
introduzione e un invito a entrare.

**Documenti normativi.** [Specifica di prodotto §8.2](../../../portfolio-fotografico-design.md) ·
[design implementativo](2026-08-07-portfolio-fotografico-design.md)

**Stato di partenza, 14 agosto 2026.** La home è già una fotografia alta `100dvh` (`92dvh`
sotto il breakpoint) con nome e introduzione appoggiati in basso. Lo scorrimento esiste per
una ragione sola: sotto c'è il footer col copyright, che il layout rende su ogni pagina.

---

## 1. Cosa vede chi arriva

La fotografia riempie lo schermo, ritagliata per coprirlo. È l'unico ritaglio del sito e la
specifica di prodotto §8.2 lo consente esplicitamente sulla protagonista.

L'header adesivo e traslucido resta identico e le scorre sopra.

In basso a sinistra, nell'ordine di lettura: il **nome**, l'**introduzione**, e sotto
l'invito **«Guarda le fotografie →»** che porta alla galleria localizzata.

Il **footer col copyright sparisce dalla home** e resta su tutte le altre pagine. È la
conseguenza diretta della richiesta: era lui a produrre lo scorrimento.

L'immagine non si muove: nessun parallasse. Resta la sola dissolvenza d'ingresso già
presente.

**Quando la fotografia di apertura manca.** `HomeView` ha già un ripiego testuale per il
caso in cui `heroPhoto` non ci sia. Lo schema la dichiara obbligatoria, quindi è uno stato
difensivo e non un percorso reale: resta com'è, **senza footer** come il resto della rotta
`home`, e senza vincoli di altezza — una pagina di poche righe che scorre se serve.

### L'invito

È un **collegamento**, non un pulsante: porta a un'altra pagina.

La freccia è **orizzontale (→), mai verso il basso**. Una freccia verso il basso su una
pagina che non scorre promette un gesto che non produce nulla — ed è il primo gesto che il
visitatore tenta.

Testo: «Guarda le fotografie» in italiano, «See the photographs» in inglese. Due voci nuove
nei dizionari. Area di tocco non inferiore a 44px, come il resto del sito.

Sta **sotto l'introduzione** su ogni schermo, non in un angolo: una sola posizione da
mantenere invece di due comportamenti diversi fra desktop e telefono.

---

## 2. Come fa a non scorrere, e a scorrere quando serve

Il modo ovvio non funziona, ed è la parte che vale la pena scrivere.

Oggi il testo è appoggiato in basso con `position: absolute`. Un elemento posizionato così
**non partecipa al calcolo dell'altezza del genitore**: se cresce, esce dallo schermo e
viene tagliato. Vietare lo scorrimento con questa struttura significa perdere contenuto.

La sezione diventa quindi una **griglia alta almeno quanto lo schermo** — `min-height`, non
`height` — con la fotografia dietro in posizione assoluta e il **contenuto nel flusso
normale**, allineato in basso.

In condizioni normali il contenuto sta dentro e il documento non supera la finestra: la
pagina non scorre. Quando il contenuto cresce oltre lo schermo — telefono in orizzontale,
oppure caratteri ingranditi — spinge la sezione e la pagina scorre da sola.

**Non c'è JavaScript e non c'è una soglia da indovinare.** Il comportamento emerge dal
layout, quindi vale anche sui dispositivi che non abbiamo previsto.

### Perché non si taglia e basta

Le linee guida di accessibilità (WCAG 1.4.4) chiedono che il testo possa raddoppiare senza
perdita di contenuto. Una home che vieta lo scorrimento e taglia l'introduzione a chi ha
ingrandito i caratteri perde contenuto: sarebbe una regressione, non una scelta estetica.

«Nessuno scorrimento» è quindi **la regola normale, non un divieto assoluto**.

---

## 3. Il footer scende dal layout alle pagine

`app/[locale]/layout.tsx` non sa quale pagina sta avvolgendo: in Next un layout non riceve i
segmenti della rotta figlia. Togliere il footer dalla sola home richiede quindi che a
deciderlo sia chi la rotta la conosce.

Il footer esce dal layout ed entra nei tre punti che oggi contano su di lui:

| Punto | Comportamento |
|---|---|
| `app/[locale]/[[...segments]]/page.tsx` | Rende il footer per ogni rotta **tranne** `home` |
| `app/[locale]/preview/[[...segments]]/page.tsx` | Stessa regola: l'anteprima mostra la pagina com'è |
| `app/[locale]/not-found.tsx` | Rende sempre il footer |
| `app/[locale]/error.tsx` | **Resta senza footer**, per scelta — vedi sotto |

**La pagina d'errore resta senza footer.** Finché il footer stava nel layout, lo riceveva
gratis: era fratello di `<main>`, quindi compariva anche quando l'error boundary sostituiva
il contenuto. Ora non più.

Non è una svista, è una decisione. `error.tsx` è un componente **client** — Next lo
pretende — e quindi non può leggere le impostazioni da Sanity: per mostrare il copyright
dovrebbe avere il nome del fotografo scritto nel codice, duplicando un valore che vive nello
Studio e che invecchierebbe in silenzio. E una pagina d'errore ha un compito solo, dire cosa
è successo e offrire di riprovare: una riga di copyright non aiuta nessuno.

**Alternative scartate.** Nasconderlo con `body:has([data-home]) footer { display: none }`
costa una riga e funziona, ma chi legge il layout non capisce perché a volte il footer non
si veda. Dare alla home una rotta e un layout propri duplica header e impostazioni e
reintroduce la frammentazione che la catch-all evita.

---

## 4. Un difetto latente che questo lavoro incontra

`HomeView.module.css` recupera l'altezza dell'header con
`margin-top: calc(-1 * var(--header-height, 5.5rem))`, usando **sempre** il token desktop.

Sotto il breakpoint l'header è alto `--header-height-compact` (76px), non
`--header-height` (92px): il margine negativo eccede di 16px e la fotografia risale più del
dovuto.

Oggi l'errore è invisibile perché sotto c'è il footer. Con la home a schermo esatto
diventerebbe una pagina più corta della finestra di 16px. Va corretto qui, usando il token
compatto sotto il breakpoint.

---

## 5. Cosa cambia, file per file

- **`app/[locale]/layout.tsx`** — non rende più `Footer`.
- **`app/[locale]/[[...segments]]/page.tsx`** — rende `Footer` per ogni rotta tranne `home`.
- **`app/[locale]/preview/[[...segments]]/page.tsx`** — stessa regola.
- **`app/[locale]/not-found.tsx`** — rende `Footer`.
- **`views/HomeView.tsx`** — aggiunge il collegamento alla galleria.
- **`views/HomeView.module.css`** — `min-height` al posto di `height`, contenuto nel flusso,
  margine negativo corretto sotto il breakpoint, rimozione della regola `92dvh`.
- **`lib/i18n/dictionaries/{it,en}.ts`** — la voce dell'invito.

---

## 6. Come si verifica

**Il criterio che conta è misurabile:** sulla home, in condizioni normali, l'altezza del
documento non supera quella della finestra.

End-to-end:

- con finestra 1280×800 e 390×844 la home **non scorre** (`scrollHeight <= clientHeight`);
- con i **caratteri al 200%** — la radice portata da 16px a 32px — la home **scorre**
  (`scrollHeight > clientHeight`) e l'introduzione resta raggiungibile invece di essere
  tagliata;

  **Corretto il 14 agosto 2026, dopo averlo misurato.** Una prova basata sul solo schermo
  basso non serviva: a 640×340, con l'introduzione vera, il contenuto misura 212px e ci sta
  comodamente — la soglia reale è a 211px di altezza, che nessun telefono ha. È
  l'ingrandimento del testo, non lo schermo piccolo, a mettere davvero alla prova la regola,
  ed è anche lo scenario che WCAG 1.4.4 nomina.
- l'invito porta a `/it/fotografie` e a `/en/photographs`;
- il footer non è nella home ed è presente su galleria, progetti, about e 404;
- axe senza violazioni sulla home nei due temi.

Unitari:

- la home rende il collegamento con l'etichetta della lingua corrente e l'indirizzo giusto;
- la catch-all rende il footer per gallery, projects, about e non per home.

Il test del non scorrimento va scritto **per primo**: è l'unico che, fallendo, dice che il
lavoro non ha raggiunto il suo scopo.

---

## 7. Fuori perimetro

Non si tocca l'header, appena ridisegnato. Non si tocca la galleria. Non si introducono
animazioni oltre quelle esistenti. La fotografia di apertura resta quella scelta dallo
Studio: questo lavoro non cambia da dove viene.
