# Le tre verifiche che non si automatizzano

Nessuna suite le sostituisce, ed è il motivo per cui hanno un documento invece
di una riga in un piano. Servono una persona: una perché richiede l'accesso
allo Studio, una perché richiede orecchie, e una perché richiede due dita su un
telefono vero.

---

## 1. Prova di scala dello Studio

**Cosa si sta mettendo alla prova.** Il plugin di ordinamento monta
un'anteprima e una sottoscrizione **per ogni documento**, senza
virtualizzazione. Il design fissa la soglia di guardia a 150 fotografie, ma
quel numero non è mai stato verificato: è un'ipotesi scritta con sicurezza. Il
rischio non è il trascinamento scomodo, è il pannello Fotografie inutilizzabile
il giorno in cui l'archivio cresce.

Oggi ce ne sono 24, quindi non è urgente. È però l'unica cosa che, crescendo,
peggiora da sola.

### Come farla

I documenti di prova riusano un asset già presente e non caricano immagini: si
misura il costo per documento del pannello, non la banda. Gli id hanno un
prefisso tutto loro, ed è quello che rende la pulizia verificabile.

```bash
npm run scala:crea
```

Poi, nello Studio, **con la scheda di rete vuota e la cache disattivata**:

1. apri **Fotografie** e cronometra da quando il pannello compare a quando
   l'elenco è scorrevole senza scatti;
2. scorri fino in fondo e nota se lo scorrimento resta fluido;
3. trascina una fotografia dalla cima al fondo e nota se il trascinamento
   risponde;
4. ripeti su una finestra stretta, che è la condizione peggiore.

Alla fine, sempre:

```bash
npm run scala:rimuovi
```

Lo script riconta i documenti e fallisce se ne restano di prova, o se sono
spariti documenti che di prova non erano.

### Come leggere il risultato

- **Se a 500 il pannello regge**, la soglia di 150 è troppo prudente: alzala
  nel design §11.1 annotando la misura.
- **Se non regge**, trova per tentativi il punto in cui smette di reggere,
  conferma la soglia e scrivi accanto la mitigazione — per esempio una
  struttura che divide le fotografie per anno, così che nessun elenco cresca
  senza limite.

In entrambi i casi il numero va scritto: una soglia senza una misura accanto
torna a essere un'ipotesi appena qualcuno la rilegge.

---

## 2. Passata con screen reader

**Perché non basta axe.** Le violazioni automatiche sono zero su dieci pagine
per due temi, lightbox compresa. Ma axe verifica che il markup sia lecito, non
che l'esperienza sia comprensibile: un `aria-label` corretto può essere
un'informazione inutile, e un annuncio giusto al momento sbagliato è rumore.

Con VoiceOver (macOS: `cmd + F5`) o NVDA, provare:

**La lightbox.** Deve annunciarsi come finestra modale, e il contenuto sotto
non deve essere raggiungibile continuando a tabulare. Aprire una fotografia e
provare a raggiungere l'header: se ci si arriva, la modale non sta trattenendo
il focus.

**La posizione, navigando con le frecce.** A ogni cambio va annunciato «2 / 20»
e simili. Va ascoltato anche il caso in cui la fotografia tarda: c'è una barra
di attesa con `role="progressbar"` e la figura è marcata `aria-busy`.

**«Carica altre».** Deve annunciare che sta caricando, e a caricamento finito
il focus deve spostarsi sulla prima fotografia nuova — altrimenti chi naviga a
tastiera resta in fondo alla pagina precedente senza sapere che è arrivato
altro.

**Il testo italiano dentro le pagine inglesi.** Sulla pagina inglese del
progetto il titolo è marcato `lang="it"`: va ascoltato che venga pronunciato
con la fonetica italiana e non letta all'inglese. È il controllo che dice se
`lang` sta funzionando davvero, e nessun test automatico lo sente.

### Cosa fare dei risultati

Annotare ogni problema con la pagina, il gesto e ciò che si è sentito. Un
problema di screen reader descritto come «l'annuncio è strano» non è
riproducibile, e finirà per non essere corretto.

---

## 3. I gesti, su un telefono vero

**Perché non è automatizzabile.** `Touchscreen` di Playwright dichiara di emulare soltanto
i gesti di tap; il progetto `iphone` gira su WebKit, quindi non c'è un CDP a cui ripiegare;
e i `TouchEvent` costruiti a mano non generano Pointer Events. Rotella, doppio clic e
tastiera sono sotto test in `e2e/zoom.spec.ts`; lo swipe è esercitato con `page.mouse` in
`e2e/lightbox.spec.ts`, che è un puntatore vero ma è **uno solo e non è un dito**. La
pizzicata, e tutto ciò che dipende dal secondo dito o dalla taglia della mano, no — e non lo
sarà.

Su un telefono, aperta una fotografia in galleria:

1. **pizzicare sulla fotografia** e verificare che si ingrandisca lei, non la pagina;
2. **trascinare** e verificare che ci si sposti in tutte le direzioni senza che la
   fotografia si stacchi dai propri bordi, cioè senza che si possa trascinarla oltre il
   punto in cui il suo bordo entra in scena.

   Attenzione a non scambiare per un difetto ciò che non lo è: da ingranditi la cornice
   è tutto lo schermo, e finché l'ingrandimento non basta a coprirlo resta del nero sopra
   e sotto — una quadrata su un telefono lo copre da 2,2× in su. Il nero che si muove
   insieme alla fotografia è un difetto; il nero fermo ai lati non lo è;
3. **doppio tocco** e verificare che porti al doppio e che un secondo doppio tocco torni
   a schermo intero;
4. **pizzicare sulla didascalia**, fuori dalla fotografia, e verificare che lì ingrandisca
   ancora la pagina: è il perimetro dichiarato, ed è ciò che tiene in piedi WCAG 1.4.4;
5. **arrivare al tetto** su una fotografia grande e su una da 1080 px, e guardare se
   l'immagine resta accettabile o si vede sgranata. Se si vede, il minimo garantito di 2×
   in `lib/lightbox/zoom.ts` va rivisto — annotando la misura.

### Lo sfogliare con un dito

Le regole stanno in `lib/lightbox/swipe.ts` e sono verificate nell'aritmetica; il
collegamento a un puntatore è verificato in jsdom e con `page.mouse`. Quel che resta
indimostrato è proprio ciò che serve un dito per dire.

6. **trascinare in orizzontale** a riposo e verificare che la fotografia segua il dito
   mentre si trascina, senza ritardo percepibile e senza staccarsi da esso;
7. **lasciare a metà strada** e verificare che torni al suo posto, e **lasciare oltre metà
   schermo** e verificare che cambi;
8. **dare un colpetto corto e veloce**, senza attraversare lo schermo, e verificare che
   cambi lo stesso: è l'unico modo in cui si sfoglia davvero in piedi con una mano sola;
9. **trascinare in verticale** sulla fotografia e verificare che non scivoli di lato;
10. **appoggiare un secondo dito** mentre si sta trascinando e verificare che lo sfogliare
    si annulli e cominci una pizzicata, senza che la fotografia cambi al rilascio. È
    l'unico punto del gesto che nessuna delle due suite tocca: in jsdom il secondo dito è
    un evento sintetico, e `page.mouse` di dita ne ha una;
11. **ingrandire e poi trascinare in orizzontale** e verificare che si sposti la vista
    dentro la fotografia invece di cambiare fotografia;
12. **arrivare all'ultima fotografia** e trascinare ancora in avanti: deve cedere di poco e
    fermarsi, e tornare al suo posto al rilascio.

**Le quattro soglie da tarare, ed è il vero motivo per cui questa prova esiste.** Sono
tutte scelte a tavolino e nessuna è stata misurata su una mano: `FRAZIONE_SOGLIA` (un
quinto della larghezza), `VELOCITA_SCATTO_PX_MS` (0,5 px/ms), `MINIMO_SCATTO_PX` (30 px) e
`CEDIMENTO_AL_BORDO` (un quarto), tutte in `lib/lightbox/swipe.ts`, più `IMPEGNO_PX` (10
px) che decide l'asse. I sintomi da cui si riconosce quale è sbagliata:

- **cambia da sola** mentre si regge il telefono o si scorre → `FRAZIONE_SOGLIA` troppo
  bassa, oppure `VELOCITA_SCATTO_PX_MS` troppo bassa se succede solo alzando il dito in
  fretta;
- **non cambia mai** senza attraversare tutto lo schermo → `FRAZIONE_SOGLIA` troppo alta,
  oppure `VELOCITA_SCATTO_PX_MS` troppo alta se i colpetti non vengono raccolti;
- **la fotografia parte di lato mentre si scorre in verticale** → `IMPEGNO_PX` troppo
  basso, cioè l'asse si fissa prima che il dito abbia detto dove va;
- **il bordo sembra rotto invece che finito** → `CEDIMENTO_AL_BORDO`, in un verso o
  nell'altro: se non si muove nulla sembra un comando spento, se si muove troppo sembra un
  cambio riuscito a metà.

Ogni valore corretto va riscritto nel commento accanto alla costante insieme alla misura e
alla data, sostituendo la dicitura «scelta, non misurata». Finché quella dicitura è lì, la
costante è un'ipotesi.

### Cosa fare dei risultati

Come per le altre due: pagina, gesto e cosa si è visto. «Lo zoom è strano» non è
riproducibile e finirà per non essere corretto.
