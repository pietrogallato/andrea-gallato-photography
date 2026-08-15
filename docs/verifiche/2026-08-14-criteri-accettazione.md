# Criteri di accettazione — esito al 14 agosto 2026

Rilettura della specifica di prodotto §17, uno per uno. Distingue ciò che è
**provato** da ciò che è vero **per costruzione** e da ciò che resta **aperto**:
le tre cose non si equivalgono, e confonderle è il modo più rapido di
dichiarare finito un progetto che non lo è.

---

**1. Il fotografo carica più immagini, completa i dati, le mette in galleria o
in un progetto, controlla l'anteprima e pubblica — senza toccare il codice.**

**Aperto.** Tutti i pezzi esistono: il tool «Carica fotografie» nello Studio,
l'anteprima, la pubblicazione. Nessuno è stato esercitato da Andrea con file
suoi, e il tool non è mai stato aperto dietro il login. Serve inoltre
valorizzare `SANITY_PREVIEW_SECRET` e `SANITY_API_READ_TOKEN`, oggi vuote.

**2. Una fotografia indipendente, visibile in galleria e riusata in più
progetti senza duplicazione.**

**Provato.** «Wedding Day, Ordinary Street» sta in galleria *e* dentro il
progetto Concorso Trieste, come un solo documento: i due lotti di caricamento
ne hanno riconosciuto l'identità byte per byte. Un test blocca la regressione —
se quel riferimento smettesse di coincidere, sarebbe un doppione.

**3. Le quattro pagine in italiano e inglese, con fallback italiano.**

**Provato**, sul sito live. Tutte le rotte rispondono 200 in entrambe le
lingue. Il fallback è visibile sulla pagina inglese del progetto, dove il
titolo italiano compare marcato `lang="it"`.

**4. Tema scuro predefinito, chiaro opzionale, senza flash, con memoria.**

**Decaduto il 14 agosto 2026.** Il tema chiaro è stato rimosso: ne resta uno solo,
scuro, quindi non c'è più una scelta da ricordare né un lampeggio da evitare.

**5. Lightbox usabile con mouse, tastiera e touch; mostra solo titolo, anno e
luogo quando ci sono.**

**Provato per mouse e tastiera** (frecce, Esc, ritorno del focus) e per la
didascalia condizionale. Il **touch** è coperto dai pulsanti di navigazione,
che sono l'alternativa dichiarata allo swipe: i gesti veri non sono sotto test.

**6. Caricamento responsive, progressivo, senza crop non controllati né
degradazione.**

**Vero per costruzione**, con una parte aperta. La scala di larghezze, `sizes`,
il segnaposto sfocato e `fit: max` (che non ritaglia) sono in essere, e la
lightbox dichiara la larghezza reale. **La taratura della qualità di
compressione, oggi ferma a 85, non è stata fatta** su paesaggio, street e
ritratto.

**7. Le bozze non sono pubbliche; pubblicare aggiorna solo le pagine
coinvolte.**

**Provato, oggi.** Con una bozza vera creata e poi cancellata: la galleria
pubblica ne mostrava 20, l'anteprima 21. La revalidation mirata è stata
verificata in Fase 2 e il funzionamento del webhook è stato confermato
dall'utente.

**8. Il sito resta navigabile con l'ultima versione memorizzata durante
un'indisponibilità di Sanity.**

**Vero per costruzione, non provato con un guasto simulato.** Le pagine
pubbliche sono prerenderizzate e servite senza interrogare Sanity, quindi una
sua indisponibilità non le tocca. Resta però da misurare il comportamento di
«Carica altre», che passa da una Server Action e a Sanity ci parla: durante un
guasto la navigazione regge, la paginazione no. Non ho simulato l'interruzione
in questa sessione.

**9. I test automatici passano e le verifiche manuali non rilevano problemi
bloccanti.**

**Automatici: sì.** 357 unitari verdi più 4 che si disattivano da soli quando
le cartelle sorgente non ci sono; 205 end-to-end su quattro ambienti; zero
violazioni axe su dieci pagine per due temi, più la lightbox aperta, misurate
anche contro il sito live.

**Manuali: aperte.** Mancano la passata con screen reader e la prova di scala
dello Studio. Nessuna delle due è sostituibile con una suite automatica, ed è
il motivo per cui sono elencate invece che dichiarate.

---

## Cosa resta, in ordine di rischio

1. **La prova con screen reader** (§17.9). Nessun test automatico la
   sostituisce, e riguarda l'unica cosa che il sito deve fare: farsi leggere.
2. **La prova di scala dello Studio.** Il plugin di ordinamento monta
   un'anteprima e una sottoscrizione per ogni documento, senza virtualizzazione:
   la soglia di guardia è a 150 fotografie e non è mai stata messa alla prova.
   Oggi ce ne sono 24, quindi non è urgente — ma la soglia resta un'ipotesi.
3. **Il tool provato con file veri**, dietro il login.
4. **La taratura della compressione** su fotografie reali.
5. **Il guasto simulato di Sanity**, per il criterio 8.
