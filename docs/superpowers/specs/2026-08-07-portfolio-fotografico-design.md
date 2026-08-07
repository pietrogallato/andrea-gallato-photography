# Portfolio fotografico Andrea Gallato — Design implementativo

Data: 7 agosto 2026
Stato: approvato dall'utente, pronto per la stesura del piano

## 0. Rapporto con la specifica di prodotto

Esistono due documenti normativi e non si sovrappongono:

- [`portfolio-fotografico-design.md`](../../../portfolio-fotografico-design.md) è normativo per **cosa** costruire: obiettivi, ambito, modello dei contenuti, esperienza editoriale, accessibilità, criteri di accettazione.
- Questo documento è normativo per **come** costruirlo: stack, struttura dei moduli, algoritmi, contratti fra le parti, strategia di test, sequenza di consegna.

Dove questo documento tace, vale la specifica di prodotto. Dove la specifica di prodotto tace su una scelta tecnica, vale questo documento. In caso di conflitto apparente prevale la specifica di prodotto e il conflitto va segnalato invece di essere risolto in autonomia.

Il sito è per **Andrea Gallato**. Il nome del fotografo vive comunque in `siteSettings` (specifica §5.5) e non va scritto a mano nel codice al di fuori dei valori di seed.

## 1. Decisioni prese durante il brainstorming

| Decisione | Scelta | Motivazione |
|---|---|---|
| Progetto Sanity | Creato ex novo: `andrea-gallato-photography`, dataset `production` e `development` | L'utente non ha progetti esistenti da riutilizzare |
| Stack di test | Vitest + Testing Library + Playwright | Vitest si integra nativamente con TS ed ESM su Next 15; Jest richiede configurazione ESM fragile |
| Consegna | Tre fasi con checkpoint | La specifica copre sito pubblico, Studio, webhook e un tool custom: troppo per una singola verifica finale |
| Layout galleria | Righe giustificate | Rispetta l'ordine editoriale manuale letto riga per riga, a differenza del masonry a colonne |
| Contenuti iniziali | Placeholder generati | Nessuna fotografia disponibile in Fase 1; da sostituire con file reali prima dell'accettazione |
| Styling | CSS Modules + design token | Specifica §7 (token riutilizzabili, nessuna libreria di componenti) e §15 (dipendenze ridotte) |

## 2. Stack

- Next.js 15, App Router, React 19, TypeScript in modalità `strict`
- Sanity v4: `sanity`, `next-sanity`, `@sanity/client`, `@sanity/image-url`, `@sanity/webhook`, `@sanity/orderable-document-list`
- `sharp` come dipendenza di sviluppo, solo per generare i placeholder di seed
- Vitest, `@testing-library/react`, `@testing-library/user-event`, jsdom, Playwright
- npm come gestore pacchetti (pnpm non è installato sulla macchina), versioni bloccate nel lockfile

Nessuna libreria di componenti, nessun framework CSS, nessuna libreria di animazione, nessuna libreria di state management.

## 3. Struttura del repository

```
app/
  layout.tsx                    html lang dinamica, script anti-flash del tema
  not-found.tsx                 404 non localizzata di ultima istanza
  sitemap.ts
  robots.ts
  [locale]/
    layout.tsx                  header, footer, dizionario, provider tema
    page.tsx                    homepage
    not-found.tsx               404 localizzata
    error.tsx                   error boundary localizzato
    gallery/page.tsx
    projects/page.tsx
    projects/[slug]/page.tsx
  studio/[[...tool]]/page.tsx
  api/revalidate/route.ts
components/
  layout/       Header, Footer, MobileMenu
  controls/     ThemeToggle, LocaleSwitcher
  gallery/      PhotoGrid, PhotoTile, LoadMoreButton
  lightbox/     Lightbox, LightboxImage, LightboxCaption, useFocusTrap, useSwipe
  media/        SanityImage
  feedback/     EmptyState, InlineError
lib/
  sanity/       client.ts, fetch.ts, queries.ts, image.ts, types.generated.ts
  i18n/         routes.ts, dictionaries/{it,en}.ts, localize.ts, locales.ts
  revalidation/ tags.ts
  theme/        script.ts, storage.ts
sanity/
  schemas/      photo.ts, project.ts, homePage.ts, aboutPage.ts, siteSettings.ts, index.ts
  structure/    deskStructure.ts
  actions/      publishWithReferenceCheck.ts
  tools/upload/ UploadTool.tsx, useBatchUpload.ts, dedupe.ts, uploadFile.ts
  lib/          previewUrl.ts
scripts/seed/   generatePlaceholders.ts, seedDataset.ts
styles/         tokens.css, reset.css, typography.css
docs/superpowers/specs/
e2e/            specifiche Playwright
```

Principio trasversale: **ogni logica decidibile è una funzione pura in `lib/`, testabile senza React e senza rete.** I componenti compongono, non calcolano. Le funzioni pure che questo produce sono `pickLocalized`, `resolveRoute`, `alternatePaths`, `tagsForDocument`, `buildImageUrl`, `snapWidth`, `findDuplicateAsset`, `missingRequiredFields`.

Nessun file dovrebbe superare le ~200 righe. Se un componente cresce oltre, va scomposto.

## 4. Routing bilingue con segmenti tradotti

### 4.1 Il problema

I percorsi pubblici differiscono per lingua (`/it/fotografie` contro `/en/photographs`) ma servono lo stesso componente. Le cartelle dell'App Router hanno un nome solo. Serve inoltre garantire che la forma canonica interna non sia raggiungibile, altrimenti si creano contenuti duplicati indicizzabili.

### 4.2 La soluzione

`lib/i18n/routes.ts` è l'unica fonte di verità:

```ts
export const ROUTES = {
  home:     { it: '',            en: ''            },
  gallery:  { it: 'fotografie',  en: 'photographs' },
  projects: { it: 'progetti',    en: 'projects'    },
  about:    { it: 'about',       en: 'about'       },
} as const
```

Le cartelle usano i nomi canonici interni (`gallery`, `projects`, `about`). Il middleware:

1. reindirizza `/` a `/it` con status 308;
2. per un percorso `/<locale>/<segmento>...`, cerca il segmento nella colonna di quella lingua; se lo trova, riscrive verso il nome canonico interno;
3. se il segmento corrisponde a un nome canonico che **non** è il segmento pubblico di quella lingua (per esempio `/it/gallery` o `/en/photographs` scritto al contrario), risponde 404;
4. lascia passare intatti `/studio`, `/api`, `/_next` e i file statici tramite `matcher`.

`resolveRoute(pathname)` e `alternatePaths(routeKey, params)` sono funzioni pure esportate dallo stesso modulo: alimentano il middleware, il selettore lingua, i `canonical` e gli `hreflang`. Un solo dizionario, nessuna duplicazione, e i test unitari sui "metadati e percorsi localizzati" della specifica §16 diventano test di funzioni pure.

Lo slug di progetto è identico nelle due lingue (specifica §5.2), quindi `alternatePaths` traduce solo il prefisso di lingua e il segmento di percorso.

Alternativa scartata: `rewrites` in `next.config.ts`. L'ordine di esecuzione fra middleware e rewrites di configurazione è un dettaglio del framework su cui non vogliamo dipendere, e le forme canoniche andrebbero comunque bloccate separatamente.

### 4.3 Localizzazione dei contenuti

`pickLocalized(field, locale)` restituisce il valore inglese se valorizzato e non vuoto, altrimenti quello italiano. È l'unico punto in cui il fallback è implementato. Una stringa inglese composta di soli spazi conta come non valorizzata. Non viene mai mostrato al visitatore alcun indicatore di traduzione mancante.

Le etichette d'interfaccia stanno in `lib/i18n/dictionaries/`, non in Sanity (specifica §5.5).

## 5. Livello dati, cache e revalidation

### 5.1 Client e fetch

`lib/sanity/client.ts` espone due client: uno pubblico con `useCdn: true` e `perspective: 'published'`, uno di anteprima con token server-side e `perspective: 'drafts'`. Il token vive solo in variabili d'ambiente server.

`lib/sanity/fetch.ts` espone un solo `sanityFetch({ query, params, tags })` che sceglie il client in base alla modalità anteprima e passa `next: { tags }` a `@sanity/client`. Nessun componente chiama `client.fetch` direttamente.

Le query stanno in `lib/sanity/queries.ts`, scritte con `defineQuery` così che `sanity typegen` generi i tipi di ritorno in `lib/sanity/types.generated.ts`. Ogni query proietta solo i campi necessari e include sempre `asset->metadata.dimensions.aspectRatio` e `asset->metadata.lqip`.

### 5.2 Tag di cache

`photo:<id>`, `project:<id>`, `projects-index`, `gallery`, `home`, `about`, `settings`, `sitemap`.

Ogni pagina dichiara i tag che la riguardano. Le pagine di progetto dichiarano `project:<id>` più `photo:<id>` per ogni fotografia referenziata.

### 5.3 Webhook

Il webhook Sanity è configurato con una proiezione GROQ che include già le dipendenze inverse:

```groq
{
  _id, _type, _rev,
  "slug": slug.current,
  "previousSlug": before().slug.current,
  "operation": delta::operation(),
  "referencingProjects": *[_type == "project" && references(^._id)]._id,
  "isHomeFeatured": count(*[_type == "homePage" && references(^._id)]) > 0
}
```

Così `tagsForDocument(payload)` in `lib/revalidation/tags.ts` è una funzione pura: nessuna chiamata di rete, deterministica, banale da testare, e idempotente perché produce un insieme di tag.

`app/api/revalidate/route.ts` verifica la firma con `isValidSignature` di `@sanity/webhook` **prima** di leggere il corpo come JSON, rifiuta con 401 senza dettagli, altrimenti applica `revalidateTag` su ogni tag prodotto e risponde 200. Un fallimento non compromette la versione già pubblicata e la richiesta può essere ripetuta senza effetti duplicati.

Il cambio di slug produce i tag sia del vecchio sia del nuovo percorso, tramite `previousSlug`.

## 6. Pipeline immagini

Le immagini sono servite dal CDN di Sanity, non riottimizzate da Vercel. `next.config.ts` usa `images.loader: 'custom'` con `images.loaderFile` che punta a `lib/sanity/image.ts`.

Il loader:

- accetta solo larghezze appartenenti a una scala fissa: `[320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560, 3840]`;
- `snapWidth(w)` arrotonda per eccesso alla larghezza superiore della scala, senza mai superare la larghezza nativa dell'asset (niente upscaling);
- applica `auto=format` e `fit=max`;
- non emette mai dimensioni frazionarie.

Il componente `SanityImage` incapsula `next/image` e impone: `sizes` obbligatorio, `aspect-ratio` sempre impostato dai metadati Sanity, `placeholder="blur"` con `blurDataURL` dal LQIP, `loading="lazy"` salvo esplicita priorità. **Una sola immagine per pagina può avere `priority`**: sulla homepage è la fotografia protagonista, altrove nessuna. Questo vincolo è verificato in code review, non a runtime.

Le varianti oltre 1920px sono richieste solo da hero e lightbox.

L'`hotspot` di Sanity è usato solo dove la specifica lo consente (adattamenti controllati su rapporti di schermo estremi nella hero). Galleria, progetti e lightbox non ritagliano mai.

Se un'immagine fallisce il caricamento, `SanityImage` mostra un riquadro neutro che conserva le dimensioni riservate e l'alt text, senza spostamenti di layout.

## 7. Galleria a righe giustificate

Layout ottenuto interamente in CSS, senza JavaScript di misurazione.

```css
.grid { display: flex; flex-wrap: wrap; gap: var(--space-gap); }

.tile {
  --ar: 1.5;                                  /* impostato inline dai metadati */
  flex-grow: var(--ar);
  flex-basis: calc(var(--ar) * var(--row-height));
  aspect-ratio: var(--ar);
}

.grid::after { content: ''; flex-grow: 999999; }
```

Perché funziona: in una riga, ogni elemento riceve `ar_i * H` di base più una quota della spaziatura residua proporzionale ad `ar_i`. La larghezza finale è quindi `ar_i * (H + L / Σar)`, cioè `larghezza / ar_i` è **identica per tutti gli elementi della riga**: le altezze coincidono senza alcun ritaglio. Lo pseudo-elemento `::after` finisce nell'ultima riga e ne assorbe lo spazio residuo, impedendo che gli ultimi scatti si stirino a tutta larghezza.

`--row-height` è un token che varia per breakpoint. Sotto il breakpoint mobile la griglia diventa a colonna singola (`flex-basis: 100%`).

Poiché `aspect-ratio` è noto server-side, lo spazio è riservato prima che l'immagine arrivi: nessun layout shift, requisito §14 soddisfatto per costruzione.

### 7.1 Carica altre

La galleria mostra 24 elementi e ne aggiunge 24 per volta. Nessuno scroll infinito.

`loadMorePhotos(offset)` è una Server Action che restituisce il gruppo successivo già proiettato. `LoadMoreButton` è un Client Component che gestisce solo stato di caricamento, append e errore. In caso di errore le fotografie già visibili restano al loro posto e compare un retry inline. Lo stato del pulsante è comunicato alle tecnologie assistive con `aria-live` sulla regione dei risultati e `aria-busy` sul pulsante.

Le fotografie con `showInGallery` disattivato sono escluse dalla query di galleria ma restano disponibili nei progetti.

## 8. Tema

Il tema scuro è il valore iniziale. `styles/tokens.css` definisce i token su `:root` con override su `[data-theme='light']`.

L'anti-flash è uno script inline **sincrono** nel `<head>` del root layout, non `next/script`: legge `localStorage`, imposta `data-theme` e `color-scheme` su `<html>` prima del primo paint. Se la lettura fallisce per qualunque motivo, resta il tema scuro.

`ThemeToggle` è un Client Component con `aria-pressed`, che scrive la preferenza e aggiorna l'attributo. La preferenza persiste fra navigazioni e ricaricamenti.

`prefers-reduced-motion: reduce` disattiva dissolvenze e transizioni non essenziali tramite media query nei token, non con logica JavaScript.

## 9. Lightbox

Client Component montato in un portal su `body`.

- `role="dialog"`, `aria-modal="true"`, etichetta accessibile dal titolo quando presente
- superficie sempre scura, indipendente da `data-theme`
- immagine alla massima dimensione utile, mai ritagliata
- didascalia con titolo, anno e luogo, ciascuno mostrato solo se valorizzato
- navigazione con pulsanti, frecce sinistra/destra, swipe orizzontale via Pointer Events
- chiusura con pulsante, `Esc` e swipe verticale
- focus intrappolato nella finestra, restituito all'elemento di origine alla chiusura
- scroll della pagina sottostante bloccato all'apertura e ripristinato alla chiusura, compensando la larghezza della scrollbar per evitare uno spostamento del layout
- precarico limitato a fotografia precedente e successiva
- URL della pagina invariato: non esistono pagine pubbliche per singola fotografia

`useFocusTrap` e `useSwipe` sono hook separati e testabili indipendentemente dal componente.

La lightbox è condivisa fra galleria e pagine di progetto (specifica §8.4): riceve una sequenza di fotografie e un indice iniziale, e non sa da dove viene.

## 10. SEO e metadati

`generateMetadata` per ogni pagina produce titolo e descrizione localizzati con fallback ai valori di `siteSettings`, `alternates.canonical` sul percorso pubblico localizzato, `alternates.languages` con entrambe le lingue, e Open Graph con l'immagine social predefinita o quella specifica del progetto.

`app/sitemap.ts` elenca entrambe le lingue di tutte le pagine pubbliche e dei progetti pubblicati. `app/robots.ts` esclude `/studio` e `/api`.

Progetti inesistenti, rimossi o non pubblicati chiamano `notFound()` e producono la 404 localizzata di `app/[locale]/not-found.tsx`.

## 11. Sanity Studio

### 11.1 Struttura

`deskStructure.ts` espone esattamente cinque voci: Homepage, Fotografie, Progetti, About, Impostazioni. Homepage, About e Impostazioni sono singleton non duplicabili né eliminabili. Il tool Vision è caricato solo in sviluppo.

Le Fotografie usano `@sanity/orderable-document-list` per l'ordinamento editoriale manuale con trascinamento.

### 11.2 Schemi

Gli schemi seguono §5 della specifica di prodotto. Note implementative:

- i riferimenti da `project` e `homePage` verso `photo` sono **forti**: Sanity impedisce già nativamente di eliminare una fotografia referenziata, quindi quel requisito non richiede codice;
- i campi bilingui sono raggruppati con `fieldsets` per lingua, con l'italiano etichettato come lingua di fallback;
- `slug` di progetto è univoco e stabile, con `isUnique` che considera bozze e pubblicati;
- l'anno è validato come intero in un intervallo ragionevole.

### 11.3 Blocco della pubblicazione su riferimenti in bozza

Requisito non nativo (specifica §10): homepage e progetti non sono pubblicabili finché tutte le fotografie referenziate non sono già pubblicate.

`sanity/actions/publishWithReferenceCheck.ts` avvolge l'azione `publish`: raccoglie gli id delle fotografie referenziate, interroga quali esistono come documenti pubblicati, e se qualcuna manca disabilita l'azione elencando per titolo le fotografie ancora in bozza. L'anteprima invece **può** mostrare fotografie in bozza.

### 11.4 Tool "Carica fotografie" (Fase 3)

Tool personalizzato dello Studio, non il normale campo immagine.

Sanity deduplica gli asset per hash SHA1: caricando due volte lo stesso file si riottiene lo stesso asset. Su questo si basa il rilevamento duplicati.

Per ogni file, indipendentemente dagli altri:

1. carica l'asset con `client.assets.upload('image', file)`, riportando l'avanzamento;
2. cerca un `photo` esistente che referenzi l'asset ottenuto;
3. se esiste, segnala il duplicato e offre un collegamento al documento esistente, senza crearne un altro;
4. se non esiste, crea una **bozza** `photo` con `showInGallery` disattivato;
5. lascia alt text e metadati da completare.

Il caricamento non pubblica mai automaticamente. Un fallimento parziale conserva le bozze riuscite ed elenca i file falliti con un retry che riguarda **solo** quelli.

`dedupe.ts` (dato un asset, trova il `photo` che lo usa) e la macchina a stati per file sono logica pura, testabile senza UI. `UploadTool.tsx` si limita a rendere lo stato.

## 12. Anteprima

Modalità anteprima autenticata tramite draft mode di Next.js, attivata da una route che verifica un segreto server-side. In anteprima `sanityFetch` usa il client con `perspective: 'drafts'`. L'anteprima consente entrambe le lingue e entrambi i temi. Il sito pubblico cambia solo dopo la pubblicazione.

## 13. Resilienza

- Fallimento di una richiesta Sanity durante la navigazione: resta servito il contenuto statico o memorizzato più recente.
- Riferimento opzionale non più disponibile: l'elemento viene omesso, la pagina non si rompe. Le query filtrano i riferimenti nulli (`[defined(@)]`) invece di assumerli presenti.
- Immagine non caricabile: riquadro neutro con alt text e dimensioni preservate.
- Traduzione inglese mancante: italiano.
- Preferenza tema illeggibile: tema scuro.
- Fallimento di un gruppo della galleria: retry inline, elementi già visibili intatti.
- Fallimento parziale di un caricamento multiplo: retry selettivo.
- Errori inattesi: error boundary coerenti con il design, con tentativo di ricaricamento.
- Webhook senza firma valida: 401 senza dettagli.

## 14. Sicurezza

Token di anteprima e segreto webhook solo in variabili d'ambiente server-side. Nessun token con permessi di scrittura raggiungibile dal browser pubblico. CORS Sanity limitato alle origini necessarie. Firme validate prima di ogni revalidation. Testi provenienti da Sanity renderizzati come testo, mai come HTML. Nessuna analytics e nessun cookie non essenziale.

Variabili d'ambiente:

| Nome | Lato | Uso |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | pubblico | client di lettura e Studio |
| `NEXT_PUBLIC_SANITY_DATASET` | pubblico | client di lettura e Studio |
| `NEXT_PUBLIC_SANITY_API_VERSION` | pubblico | versione API bloccata a una data |
| `SANITY_API_READ_TOKEN` | server | lettura bozze in anteprima |
| `SANITY_REVALIDATE_SECRET` | server | verifica firma webhook |
| `SANITY_PREVIEW_SECRET` | server | attivazione draft mode |
| `NEXT_PUBLIC_SITE_URL` | pubblico | canonical, hreflang, sitemap |

`.env.example` è versionato; `.env.local` no.

## 15. Test

### 15.1 Ripartizione

Vitest con jsdom copre funzioni pure e Client Components. I Server Components non sono resi da Testing Library: la loro logica di dati è estratta in funzioni pure testate separatamente, e il loro rendering è coperto dagli e2e. Questa divisione è una scelta deliberata, non una lacuna.

### 15.2 Unit

`pickLocalized` (compreso il caso stringa inglese vuota o di soli spazi), mapping dei documenti Sanity, `snapWidth` e costruzione degli URL immagine (compreso il divieto di upscaling), selezione dei contenuti pubblicabili, `tagsForDocument` per ogni tipo di documento e per cambio slug, annullamento pubblicazione ed eliminazione, `findDuplicateAsset`, `resolveRoute` e `alternatePaths`.

### 15.3 Componenti

Header desktop e mobile, `ThemeToggle` e persistenza, `LocaleSwitcher`, `PhotoGrid` e stato di `LoadMoreButton`, lightbox con focus, tastiera e controlli, avanzamento/errore parziale/retry del caricamento multiplo, stati vuoti ed errore.

### 15.4 End-to-end

Playwright contro il dataset `development` popolato dal seed: navigazione completa IT/EN, lightbox con mouse, tastiera e touch, persistenza del tema fra navigazioni e ricaricamenti, caricamento incrementale della galleria, apertura dei progetti e ordine corretto delle fotografie, blocco della pubblicazione con riferimenti in bozza, caricamento multiplo con duplicati ed errore parziale, anteprima bozza autenticata, revalidation dopo pubblicazione, 404 localizzate.

### 15.5 Seed

`scripts/seed/generatePlaceholders.ts` produce con `sharp` immagini di rapporti misti (16:9, 3:2, 2:3, 4:5, 1:1) in sRGB, lato lungo entro 4000px. `seedDataset.ts` le carica sul dataset `development` e crea fotografie, due progetti, homepage, about e impostazioni. Lo script è idempotente: rieseguirlo non duplica documenti.

I placeholder servono a sviluppare e testare i layout. **Non sostituiscono la verifica manuale della qualità fotografica** richiesta dalla specifica §16, che resta da fare su fotografie reali di paesaggio, street e ritratto prima dell'accettazione.

## 16. Fasi di consegna

### Fase 1 — Fondamenta e galleria

Repository e toolchain, progetto Sanity e dataset, `.env.example`, design token e tema anti-flash, routing i18n con middleware e dizionario, schemi Sanity completi, Studio con desk structure e ordinamento, `SanityImage` e pipeline immagini, homepage con fotografia protagonista, galleria a righe giustificate con "Carica altre", lightbox completa, script di seed, test unitari e di componenti delle parti sopra.

Checkpoint: il sito è navigabile in IT ed EN su homepage e galleria, la lightbox funziona con mouse, tastiera e touch, il tema persiste senza flash, Studio è utilizzabile.

### Fase 2 — Progetti, About, SEO, revalidation

Indice e pagina di progetto, About, `generateMetadata` con canonical e hreflang, sitemap, robots, 404 localizzate, error boundary, webhook di revalidation firmato con la mappa dei tag, stati di resilienza, test relativi.

Checkpoint: tutte le pagine pubbliche esistono in entrambe le lingue, la pubblicazione in Sanity aggiorna solo le pagine coinvolte, i metadati e le anteprime social sono corretti.

### Fase 3 — Studio avanzato e verifica

Tool "Carica fotografie", document action di blocco pubblicazione, modalità anteprima autenticata, suite e2e completa, passata di accessibilità con tastiera e lettore di schermo, passata di prestazioni sui Core Web Vitals, verifica dei contrasti in entrambi i temi.

Checkpoint: i criteri di accettazione della specifica §17 sono soddisfatti, con l'eccezione dichiarata della verifica su fotografie reali.

## 17. Rischi noti

**Ordinamento manuale su cataloghi grandi.** La specifica §5.1 prevede il trascinamento. Con 100 fotografie è comodo, verso le 500 spostare un elemento dal fondo alla cima diventa faticoso. Implementiamo come specificato; il punto va rivisto quando il catalogo cresce.

**Qualità di compressione.** La specifica §11 chiede di definire la qualità "tramite confronto visivo su un campione rappresentativo". Con soli placeholder questo confronto non è possibile: in Fase 1 fissiamo un valore prudente e lo tariamo alla prima consegna di fotografie reali.

**Verifica di accettazione incompleta senza foto reali.** I criteri §17.6 e §17.9 sulla qualità fotografica non possono essere dichiarati soddisfatti finché il catalogo contiene solo placeholder.

## 18. Cosa resta fuori

Vale integralmente l'ambito escluso dalla specifica §2: niente e-commerce, prenotazioni, area clienti, commenti, account, newsletter, ricerca full-text, filtri, tassonomie, EXIF pubblico, download degli originali, watermark, caroselli, video. Nessuno di questi va introdotto "perché costa poco".
