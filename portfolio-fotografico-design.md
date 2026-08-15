# Portfolio fotografico personale — Specifica di design

Data: 7 agosto 2026  
Stato: specifica completa e verificata, in attesa dell'approvazione dell'utente

## 1. Obiettivo

Realizzare un portfolio artistico personale per un fotografo che lavora soprattutto con paesaggio, street photography e ritratto. Il sito deve mettere la qualità e la fruizione delle fotografie davanti a ogni altro elemento e deve poter essere aggiornato sia dal fotografo sia dal figlio.

La prima versione deve:

- presentare fotografie singole e progetti fotografici;
- permettere a una fotografia di esistere autonomamente e, facoltativamente, appartenere a uno o più progetti;
- offrire un'esperienza scura e cinematografica;
- essere disponibile in italiano e inglese;
- consentire la gestione autonoma dei contenuti attraverso Sanity Studio;
- mantenere buone prestazioni con un catalogo indicativo compreso tra 100 e 500 fotografie.

## 2. Fuori ambito

La prima versione non include:

- vendita di stampe o e-commerce;
- prenotazioni, preventivi o funnel commerciali;
- area clienti o contenuti riservati;
- commenti, preferiti, account visitatori o newsletter;
- ricerca full-text, filtri avanzati, tassonomie o archivio EXIF pubblico;
- download degli originali;
- watermark visibili;
- caroselli automatici;
- video.

## 3. Architettura

Il sito sarà un unico progetto Next.js con TypeScript, App Router e rendering server-first, pubblicato su Vercel. Verranno usate versioni stabili e reciprocamente compatibili delle dipendenze al momento dell'implementazione, bloccate nel lockfile.

Sanity fornirà:

- Content Lake per i contenuti strutturati;
- Sanity Studio integrato nel progetto alla rotta `/studio`;
- gestione di bozze, anteprime e pubblicazione;
- archiviazione delle versioni web delle fotografie;
- trasformazioni responsive e distribuzione delle immagini tramite il CDN di Sanity.

Non sono previsti un database applicativo, un backend separato o un sistema di autenticazione personalizzato. L'accesso a `/studio` userà l'autenticazione Sanity e i due editor avranno credenziali separate.

Il frontend userà prevalentemente Server Components. I Client Components saranno limitati alle interazioni che ne hanno bisogno: selettore lingua, galleria incrementale e lightbox.

## 4. Flusso dei dati

1. Un editor carica una o più versioni web delle fotografie in Sanity Studio.
2. Sanity crea una bozza `photo` per ogni immagine e conserva l'asset nel proprio CDN.
3. L'editor completa i campi richiesti, collega eventualmente la foto a un progetto e apre l'anteprima.
4. Alla pubblicazione, annullamento della pubblicazione o eliminazione, un webhook Sanity firmato invalida i contenuti Next.js secondo la mappa di dipendenze descritta sotto.
5. Next.js rigenera le pagine necessarie e Vercel continua a servire le altre dalla cache.
6. Il visitatore riceve HTML e dati da Vercel e varianti responsive delle immagini direttamente dal CDN di Sanity.

In caso di indisponibilità temporanea di Sanity, il sito continua a mostrare l'ultima versione pubblicata e memorizzata. I token con permessi di lettura delle bozze e il segreto del webhook restano esclusivamente sul server.

Mappa di revalidation:

- modifica di una fotografia: galleria se pertinente, homepage se selezionata, pagine dei progetti che la referenziano e indice progetti se usata come copertina;
- modifica di un progetto: relativa pagina progetto, indice progetti, homepage se il progetto è in evidenza e sitemap;
- modifica della Homepage: homepage italiana e inglese;
- modifica di About: pagina About italiana e inglese;
- modifica delle Impostazioni: tutte le pagine pubbliche, sitemap e regole robots;
- cambio di slug, annullamento pubblicazione o eliminazione: vecchio e nuovo percorso, elenchi dipendenti, homepage se pertinente e sitemap.

Ogni invalidazione riguarda entrambe le lingue ed è idempotente. Se il webhook fallisce, la versione già pubblicata resta disponibile, l'errore viene registrato e l'operazione può essere ripetuta senza produrre effetti duplicati.

## 5. Modello dei contenuti Sanity

### 5.1 Fotografia (`photo`)

Campi:

- immagine web obbligatoria;
- alt text italiano obbligatorio;
- alt text inglese opzionale, con fallback all'italiano;
- titolo italiano e inglese opzionale;
- luogo italiano e inglese opzionale;
- anno opzionale e validato;
- opzione `showInGallery`, disattivata per impostazione iniziale;
- posizione nella galleria, gestita dall'interfaccia di ordinamento;
- eventuale hotspot dedicato alle anteprime responsive;
- stato bozza/pubblicato gestito da Sanity.

Le fotografie sono documenti autonomi. I progetti e la homepage usano riferimenti forti a questi documenti, così lo stesso asset non viene duplicato e una fotografia referenziata non può essere eliminata accidentalmente.

### 5.2 Progetto (`project`)

Campi:

- titolo IT/EN obbligatorio almeno in italiano;
- descrizione IT/EN, con italiano obbligatorio;
- slug univoco e stabile;
- anno opzionale;
- fotografia di copertina obbligatoria;
- sequenza ordinata e non vuota di riferimenti a `photo`;
- opzione per la presenza tra i progetti in evidenza;
- metadati SEO localizzati opzionali, con fallback ai contenuti del progetto.

Lo stesso slug viene usato in entrambe le lingue; cambia il prefisso locale e il segmento di percorso tradotto.

### 5.3 Homepage (`homePage`, singleton)

Campi:

- fotografia protagonista obbligatoria;
- testo introduttivo IT/EN opzionale;
- selezione ordinata di fotografie;
- selezione ordinata di progetti.

Non è previsto un carosello. La fotografia protagonista resta una scelta editoriale singola.

### 5.4 About (`aboutPage`, singleton)

Campi:

- ritratto dell'autore obbligatorio;
- biografia breve IT/EN, obbligatoria almeno in italiano;
- statement artistico IT/EN, obbligatorio almeno in italiano;
- indirizzo email obbligatorio;
- collegamenti social configurabili.

### 5.5 Impostazioni (`siteSettings`, singleton)

Campi:

- nome del fotografo obbligatorio;
- titolo e descrizione SEO predefiniti, obbligatori almeno in italiano;
- immagine social predefinita obbligatoria;
- email e collegamenti social di fallback.

Le etichette dell'interfaccia, come menu e pulsanti, vivono nei dizionari di traduzione del codice e non nel CMS.

## 6. Lingue e URL

Le lingue supportate sono italiano e inglese. L'italiano è la lingua predefinita e `/` reindirizza in modo deterministico a `/it`.

Struttura pubblica:

- `/it` e `/en` — homepage;
- `/it/fotografie` e `/en/photographs` — galleria;
- `/it/progetti` e `/en/projects` — elenco progetti;
- `/it/progetti/[slug]` e `/en/projects/[slug]` — progetto;
- `/it/about` e `/en/about` — biografia.

Il selettore lingua porta alla pagina equivalente nell'altra lingua. Se un campo inglese non è valorizzato, viene mostrato quello italiano. Non vengono mostrati indicatori di traduzione mancante al visitatore.

Ogni pagina pubblica include canonical, alternate `hreflang`, metadati localizzati, Open Graph, sitemap, regole robots e dati per la condivisione social. I progetti non pubblicati o inesistenti producono una pagina 404 localizzata.

## 7. Direzione visiva

L'identità è scura e cinematografica, ma sobria. **Il tema scuro è l'unico.**

*Deciso il 14 agosto 2026.* Il sito nasceva con un interruttore per passare al tema chiaro e una preferenza memorizzata nel browser. È stato rimosso: su un portfolio fotografico il fondo scuro non è una preferenza fra due, è il modo in cui le fotografie vanno guardate, e un tema chiaro che nessuno usa costa comunque una seconda palette da tenere in contrasto, uno script anti-lampeggio nel `<head>` e ogni pagina scansionata due volte dai test di accessibilità.

Principi:

- fondo quasi nero nel tema scuro e bianco caldo nel tema chiaro;
- colori d'accento ridotti al minimo;
- tipografia editoriale leggibile, con navigazione discreta;
- ampio spazio negativo;
- nessun elemento decorativo che competa con le fotografie;
- dissolvenze leggere e movimenti lenti;
- disattivazione delle animazioni non essenziali quando l'utente richiede movimento ridotto.

Il design non usa una libreria di componenti visivi generalista. Colori, spaziature, raggi, tipografia e durate sono definiti come design token riutilizzabili.

## 8. Navigazione e pagine

### 8.1 Header e footer

L'header contiene:

- nome del fotografo;
- collegamenti a Fotografie, Progetti e About;
- selettore IT/EN;
- interruttore tema.

Su mobile diventa un menu compatto e completamente navigabile da tastiera. Il footer contiene nome, copyright, email e social, senza moduli o newsletter.

### 8.2 Homepage

La homepage si apre con una singola fotografia quasi a schermo intero. La composizione viene preservata; hotspot e crop sono usati soltanto per adattamenti controllati su rapporti di schermo estremi. Sotto il protagonista compaiono fotografie e progetti selezionati manualmente in Sanity.

La fotografia protagonista è l'unica immagine caricata con priorità elevata.

### 8.3 Fotografie

La galleria usa una composizione editoriale responsive che rispetta i rapporti d'aspetto, senza ritagli forzati. Mostra inizialmente 24 fotografie e il comando “Carica altre” aggiunge gruppi di 24. Non viene usato lo scroll infinito.

L'ordinamento è editoriale e manuale. Le fotografie con `showInGallery` disattivato restano disponibili nei progetti ma non appaiono nella galleria generale.

### 8.4 Progetti

L'elenco mostra copertine ampie, titolo e anno opzionale. La pagina di progetto contiene introduzione bilingue e sequenza verticale ordinata delle fotografie, con spaziatura generosa. Le fotografie della sequenza possono essere aperte nella stessa lightbox della galleria.

### 8.5 About

La pagina About contiene ritratto, biografia breve, statement artistico, email e social. Non include un curriculum esteso nella prima versione.

## 9. Lightbox

La lightbox usa sempre una superficie scura per mantenere una visione coerente delle fotografie, indipendentemente dal tema del sito.

Comportamenti:

- immagine alla massima dimensione utile senza crop;
- titolo, anno e luogo mostrati solo quando presenti;
- navigazione precedente/successiva tramite pulsanti, frecce della tastiera e swipe;
- chiusura con pulsante, tasto Esc e gesto mobile appropriato;
- focus intrappolato nella finestra e restituito all'elemento di origine alla chiusura;
- scroll della pagina sottostante bloccato mentre è aperta;
- precaricamento limitato alla fotografia precedente e successiva;
- URL della pagina invariato: non esistono pagine pubbliche dedicate alle singole fotografie.

## 10. Esperienza editoriale

La struttura principale di Sanity Studio contiene soltanto Homepage, Fotografie, Progetti, About e Impostazioni.

Il comando “Carica fotografie” è uno strumento personalizzato di Sanity Studio incluso nella prima versione, non il normale campo immagine. Accetta più esportazioni web supportate e mostra avanzamento e stato per ciascun file. Per ogni file:

1. carica l'asset in Sanity;
2. controlla se esiste già un documento `photo` che usa lo stesso asset;
3. se esiste, segnala il duplicato e permette di aprire il documento esistente senza crearne un altro;
4. se non esiste, crea una bozza `photo` con `showInGallery` disattivato;
5. lascia alt text e metadati da completare prima della pubblicazione.

Il caricamento non pubblica automaticamente. Un'azione “Pubblica selezionate” è disponibile solo per le bozze che superano tutte le validazioni. Se una parte di un caricamento multiplo fallisce, le bozze riuscite vengono conservate e l'interfaccia elenca chiaramente i file falliti con un comando per riprovarli, senza ricaricare quelli già completati.

L'editor dei progetti permette di:

- selezionare fotografie esistenti;
- riordinarle con trascinamento;
- impostare la copertina;
- modificare i testi IT/EN;
- vedere l'anteprima;
- pubblicare.

La Homepage permette di selezionare fotografia protagonista, fotografie e progetti in evidenza. I campi bilingui sono raggruppati per lingua e l'italiano resta chiaramente identificato come fallback.

Validazioni di pubblicazione:

- una fotografia richiede asset e alt text italiano;
- un progetto richiede titolo italiano, descrizione italiana, slug univoco, copertina e almeno una fotografia;
- la homepage richiede una fotografia protagonista;
- About richiede ritratto, biografia italiana, statement italiano ed email;
- Impostazioni richiede nome, metadati SEO italiani e immagine social;
- l'anteprima può usare fotografie in bozza, ma homepage e progetti non possono essere pubblicati finché tutte le fotografie referenziate non sono già pubblicate;
- gli URL email e social devono avere formato valido;
- una fotografia referenziata non è eliminabile finché i riferimenti non vengono rimossi.

L'anteprima autenticata mostra bozze, entrambe le lingue e i due temi. Il sito pubblico cambia soltanto dopo la pubblicazione.

## 11. Pipeline e qualità delle immagini

Gli originali archivistici e i file RAW restano fuori da Sanity, conservati nel sistema di archiviazione del fotografo. Sanity riceve esportazioni web di alta qualità in sRGB; come linea guida operativa, il lato lungo non deve superare 4000 pixel. In questo modo l'asset originale conservato da Sanity è già una versione web e non il master d'archivio.

Il frontend usa l'integrazione Sanity per Next.js e limita le larghezze generate a un insieme stabile adatto ai layout. Ogni richiesta include larghezza intera, rapporto d'aspetto, `sizes` corretto, conversione automatica nel formato supportato e divieto di upscaling.

Regole:

- placeholder LQIP o BlurHash durante il caricamento;
- lazy loading per tutto ciò che non è il protagonista iniziale;
- massimo una fotografia con priorità elevata per pagina;
- varianti più grandi riservate a hero e lightbox;
- qualità di compressione definita tramite confronto visivo su un campione rappresentativo di paesaggi, street e ritratti;
- nessun collegamento o pulsante per scaricare l'asset originale;
- nessun watermark;
- nessun tentativo ingannevole di impedire screenshot o salvataggi delle immagini già consegnate al browser.

## 12. Stati di errore e resilienza

- Se una richiesta Sanity fallisce durante la navigazione, viene mantenuto il contenuto statico o memorizzato più recente.
- Se un riferimento opzionale non è più disponibile, l'elemento viene omesso senza rompere l'intera pagina.
- Se un'immagine non può essere caricata, viene mostrato un riquadro neutro con testo alternativo e dimensioni preservate.
- Se la traduzione inglese manca, viene usato l'italiano.
- Se la preferenza tema non è leggibile, viene usato il tema scuro.
- Se il caricamento di un altro gruppo della galleria fallisce, le fotografie già visibili restano al loro posto e viene offerto un tentativo di ripetizione inline.
- Se un caricamento multiplo in Studio fallisce parzialmente, i file riusciti non vengono ricaricati e l'editor può riprovare soltanto quelli falliti.
- Progetti inesistenti, rimossi o non pubblicati restituiscono 404.
- Gli errori inattesi vengono intercettati da error boundary coerenti con il design e offrono un tentativo di ricaricamento.
- Il webhook rifiuta richieste prive di firma valida e non espone dettagli sensibili.

## 13. Accessibilità

Requisiti:

- struttura semantica con un solo titolo principale per pagina;
- alt text italiano obbligatorio e inglese con fallback;
- contrasto verificato in entrambi i temi;
- focus sempre visibile;
- tutte le funzioni disponibili da tastiera;
- lightbox conforme al comportamento di una finestra modale;
- aree cliccabili adeguate su dispositivi touch;
- supporto a `prefers-reduced-motion`;
- lingua del documento aggiornata correttamente tra IT ed EN;
- stato dei controlli tema, lingua e “Carica altre” comunicato alle tecnologie assistive.

## 14. Prestazioni

Le pagine pubbliche sono statiche o memorizzate e vengono rigenerate su pubblicazione. Il JavaScript client è limitato alle interazioni. Le query Sanity richiedono soltanto i campi necessari e la galleria viene caricata per gruppi di 24 elementi.

I criteri di qualità sono:

- valori Core Web Vitals nella fascia “buona” sulle pagine principali in produzione;
- assenza di spostamenti visibili dovuti alle immagini;
- nessun caricamento anticipato dell'intero catalogo;
- nessuna trasformazione immagine con dimensioni arbitrarie o non intere;
- nessuna degradazione visibile su un campione di immagini controllato su schermi standard e ad alta densità.

## 15. Sicurezza e privacy

- token di anteprima e segreti webhook solo in variabili server-side;
- nessun token con scrittura nel browser pubblico;
- CORS Sanity limitato alle origini necessarie;
- firme dei webhook validate prima della revalidation;
- output testuali Sanity renderizzati in modo sicuro;
- dipendenze ridotte e aggiornate;
- nessuna analytics o cookie non essenziale nella prima versione.

L'uso previsto è personale e non commerciale. Se il sito diventerà uno strumento professionale o commerciale, il piano Vercel e gli eventuali obblighi privacy dovranno essere rivalutati.

## 16. Strategia di test

### Test unitari

- fallback della versione inglese verso l'italiano (EN → IT);
- mapping dei documenti Sanity;
- generazione e validazione degli URL immagine;
- selezione dei contenuti pubblicabili;
- mappa delle dipendenze di revalidation;
- rilevamento dei duplicati nel caricamento multiplo;
- metadati e percorsi localizzati.

### Test di componenti

- header mobile e desktop;
- interruttore tema e persistenza;
- selettore lingua;
- griglia e stato “Carica altre”;
- lightbox, focus e controlli;
- avanzamento, errore parziale e retry del caricamento multiplo in Studio;
- stati vuoti ed errore.

### Test end-to-end

- navigazione completa IT/EN;
- apertura, scorrimento e chiusura della lightbox con mouse, tastiera e touch;
- persistenza del tema tra navigazioni e ricaricamenti;
- caricamento incrementale della galleria;
- apertura dei progetti e ordine corretto delle fotografie;
- blocco della pubblicazione quando homepage o progetti referenziano fotografie in bozza;
- caricamento multiplo, rilevamento duplicati, errore parziale e retry selettivo;
- anteprima bozza autenticata;
- pubblicazione Sanity e aggiornamento delle pagine interessate;
- pagine 404 localizzate.

### Verifiche manuali

- qualità fotografica su paesaggio, street e ritratto;
- mobile, tablet, desktop e schermi ad alta densità;
- temi chiaro e scuro;
- movimento ridotto;
- tastiera e lettore di schermo;
- principali browser moderni;
- metadati SEO, sitemap e anteprime social.

## 17. Criteri di accettazione

Il progetto è accettabile quando:

1. Il fotografo riesce senza interventi sul codice a caricare più immagini, completare i dati minimi, inserirle nella galleria o in un progetto, controllare l'anteprima e pubblicarle.
2. Una fotografia può essere indipendente, visibile nella galleria e riutilizzata in più progetti senza duplicazione.
3. Homepage, Fotografie, Progetti e About funzionano in italiano e inglese, con fallback italiano.
4. Tema scuro predefinito e tema chiaro opzionale funzionano senza flash visibili e ricordano la scelta.
5. La lightbox è utilizzabile con mouse, tastiera e touch e mostra soltanto titolo, anno e luogo quando disponibili.
6. Il caricamento delle fotografie è responsive, progressivo e privo di crop non controllati o degradazione visibile.
7. Le bozze non sono pubbliche e le modifiche pubblicate aggiornano soltanto le pagine coinvolte.
8. Il sito resta navigabile usando l'ultima versione memorizzata durante un'indisponibilità temporanea di Sanity.
9. I test automatici previsti passano e le verifiche manuali non rilevano problemi bloccanti di accessibilità, qualità o prestazioni.

## 18. Decisione architetturale

È stato scelto il modello “catalogo fotografico condiviso”: ogni fotografia è un documento autonomo e i progetti contengono riferimenti ordinati. È preferito alle immagini incorporate perché evita duplicazioni e rimane gestibile con alcune centinaia di fotografie; è preferito a un DAM avanzato perché non introduce ricerca, tag ed EXIF che appesantirebbero il flusso editoriale senza contribuire all'obiettivo del portfolio.
