# Le due verifiche che non si automatizzano

Nessuna suite le sostituisce, ed è il motivo per cui hanno un documento invece
di una riga in un piano. Servono una persona: una perché richiede l'accesso
allo Studio, l'altra perché richiede orecchie.

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
