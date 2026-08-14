# Portfolio fotografico Andrea Gallato — Design implementativo

Data: 7 agosto 2026
Stato: revisionato dopo verifica avversariale, approvato dall'utente sulle decisioni di stack e galleria
Revisione: 2

## 0. Rapporto con la specifica di prodotto

Esistono due documenti normativi e non si sovrappongono:

- [`portfolio-fotografico-design.md`](../../../portfolio-fotografico-design.md) è normativo per **cosa** costruire: obiettivi, ambito, modello dei contenuti, esperienza editoriale, accessibilità, criteri di accettazione.
- Questo documento è normativo per **come** costruirlo: stack, struttura dei moduli, algoritmi, contratti fra le parti, strategia di test, sequenza di consegna.

Dove questo documento tace, vale la specifica di prodotto. Dove la specifica di prodotto tace su una scelta tecnica, vale questo documento. In caso di conflitto apparente prevale la specifica di prodotto e il conflitto va segnalato invece di essere risolto in autonomia.

Il sito è per **Andrea Gallato**. Il nome del fotografo vive in `siteSettings` (specifica §5.5) e non va scritto a mano nel codice al di fuori dei valori di seed.

Questa revisione incorpora le correzioni emerse da una verifica avversariale condotta il 7 agosto 2026 contro la documentazione ufficiale corrente di Next.js, Sanity, WCAG e il registro npm. Le affermazioni tecniche qui contenute sono state verificate; quelle che restano non verificate sono marcate esplicitamente come tali.

## 1. Decisioni prese

| Decisione | Scelta | Motivazione |
|---|---|---|
| Progetto Sanity | `andrea-gallato-photography` (`xpdypayk`), dataset `production` e `development` | Creato il 7 agosto 2026. Il piano gratuito consente **due** dataset: il terzo dataset `e2e` previsto inizialmente non è creabile, quindi gli e2e girano su `development` |
| Stack | Next 16 + Sanity 6, versioni correnti | Next 15 + Sanity 4 obbligherebbe a pin EOL (`sanity@4.22.0` senza patch da dicembre 2025, `next-sanity@11.6.13` dietro un dist-tag secondario) |
| Runtime | Node 24 LTS | Node 25 è EOL da giugno 2026 e Vercel non lo offre |
| Test | Vitest + Testing Library + Playwright | Integrazione nativa con TS ed ESM |
| Consegna | Tre fasi con checkpoint | Sito pubblico, Studio, webhook e tool custom: troppo per una singola verifica finale |
| Layout galleria | Righe giustificate con **packer server-side** | Il CSS puro non controlla l'altezza di riga (varia fino a 2×) e rende `sizes` non calcolabile |
| Routing | Catch-all + dizionario, **nessun middleware/proxy** | Elimina 404 non localizzata, mismatch di idratazione, rewrite sulle Server Action e cache chiavata sul percorso interno |
| Contenuti iniziali | Placeholder generati | Nessuna fotografia disponibile in Fase 1 |
| Styling | CSS Modules + design token | Specifica §7 e §15 |

## 2. Stack e versioni

Le versioni sono parte del contratto, non un dettaglio del lockfile.

| Pacchetto | Versione | Nota |
|---|---|---|
| `node` | 24.x LTS | `.nvmrc` con `24`, `engines.node: "24.x"` in `package.json`, Node 24.x nelle Project Settings di Vercel |
| `next` | `^16.3` | In Next 16 la convenzione `middleware` è deprecata e rinominata `proxy`; questo progetto non usa né l'una né l'altra |
| `react` / `react-dom` | `^19.2.3` | Peer di `next-sanity@13` |
| `sanity` | `^6.9` | Studio v6 |
| `next-sanity` | `^13.3` | Peer: `next ^16`, `sanity ^5.29 \|\| ^6`, `@sanity/client ^7.26.1` |
| `@sanity/client` | `^7.26` | |
| `@sanity/image-url` | `^2` | |
| `@sanity/webhook` | `^4` | Da v4 le funzioni di validazione sono **asincrone** |
| `@sanity/orderable-document-list` | `^2` | Peer: `sanity ^5 \|\| ^6` |
| `styled-components` | `^6.1` | **Peer obbligatorio di `sanity`** per lo Studio embedded. Non è usato dal sito pubblico: l'affermazione "nessun framework CSS" vale per il frontend, non per lo Studio |
| `lexorank` | ultima | Calcolo di `orderRank` nelle creazioni programmatiche (§11.4, §15.5) |

Dipendenze di sviluppo per i test, elencate per esteso perché la lista parziale causa fallimenti non ovvi:

`vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom` (peer esplicito di Testing Library dalla v16, non più incluso), `@testing-library/user-event`, `vite-tsconfig-paths` (senza, gli import con alias falliscono nei test), `@playwright/test`, `@axe-core/playwright`, `vitest-axe`, `sharp` (solo per il seed).

Nessuna libreria di componenti, nessun framework CSS nel frontend, nessuna libreria di animazione, nessuna libreria di state management.

## 3. Struttura del repository

```
app/
  [locale]/
    layout.tsx                  ROOT LAYOUT: <html lang>, <body>, script tema
    [[...segments]]/page.tsx    catch-all: risolve la rotta dal dizionario
    not-found.tsx               404 localizzata
    error.tsx                   error boundary localizzato
  studio/
    layout.tsx                  secondo root layout, isolato
    [[...tool]]/page.tsx
  api/revalidate/route.ts
  api/preview/[enable|disable]/route.ts
  sitemap.ts
  robots.ts
views/                          un modulo per pagina, invocato dalla catch-all
  HomeView.tsx, GalleryView.tsx, AboutView.tsx  (fatte)
  ProjectsView.tsx, ProjectView.tsx             (Fase 2)
components/
  layout/       Header, Footer, MobileMenu, SkipLink
  controls/     ThemeToggle, LocaleSwitcher, LocaleNav
  theme/        ThemeScript
  gallery/      PhotoGrid, PhotoRow, PhotoTile, LoadMoreButton
  lightbox/     Lightbox, LightboxCaption, useSwipe
  media/        SanityImage
  feedback/     EmptyState, InlineError, StatusRegion
lib/
  sanity/       client.ts, fetch.ts, queries.ts, imageUrl.ts, imageLoader.ts, types.generated.ts
  i18n/         routes.ts, locales.ts, dictionaries/{it,en}.ts, localize.ts
  gallery/      packRows.ts, sizes.ts, pageSize.ts, toGalleryPhoto.ts
  fonts.ts      definizioni next/font
  revalidation/ tags.ts
  theme/        script.ts
sanity/
  schemas/      photo.ts, project.ts, homePage.ts, aboutPage.ts, siteSettings.ts, index.ts
  structure/    deskStructure.ts
  actions/      publishWithDraftReferenceReport.ts
  tools/upload/ UploadTool.tsx, useBatchUpload.ts, dedupe.ts, uploadFile.ts, orderRank.ts
scripts/seed/   generatePlaceholders.ts, seedDataset.ts
styles/         tokens.css, reset.css, typography.css
app/actions/    loadMorePhotos.ts
e2e/            specifiche Playwright. Due ambienti: i progetti browser girano
                contro un build di produzione, il progetto `dev` contro
                `next dev`, dove React monta due volte e lascia attivi i propri
                avvisi. Tre difetti reali vivevano solo li
docs/superpowers/specs/
```

**Non esiste `app/layout.tsx`.** Un root layout senza segmento dinamico sopra di sé non riceve `params` e non potrebbe rendere `<html lang>` dinamica: il locale sarebbe fisso anche sulle pagine inglesi, violando WCAG 3.1.1 (livello A). `app/[locale]/layout.tsx` è quindi il root layout e definisce `<html>` e `<body>`. Di conseguenza `/studio` ha un proprio root layout: la navigazione fra root layout diversi provoca un full page load, accettabile fra sito e Studio.

*Da confermare in Fase 1:* Next 16.3 espone `next/root-params` per leggere i parametri di root da qualunque Server Component senza prop drilling. Se disponibile e stabile, si usa; altrimenti il locale viene passato come prop.

Principio trasversale: **ogni logica decidibile è una funzione pura in `lib/`, testabile senza React e senza rete.** Le funzioni pure prodotte sono `pickLocalized`, `resolveRoute`, `alternatePaths`, `isLocale`, `packRows`, `sizesForTile`, `directTagsFor`, `buildImageUrl`, `snapWidth`, `findDuplicatePhoto`, `nextOrderRank`.

Nessun file dovrebbe superare le ~200 righe.

## 4. Routing bilingue

### 4.1 Il problema

I percorsi pubblici differiscono per lingua (`/it/fotografie` contro `/en/photographs`) ma servono lo stesso componente, e la forma canonica interna non deve essere raggiungibile.

### 4.2 La soluzione: catch-all guidata dal dizionario

`lib/i18n/routes.ts` è l'unica fonte di verità:

```ts
export const ROUTES = {
  home:     { it: [],             en: []              },
  gallery:  { it: ['fotografie'], en: ['photographs'] },
  projects: { it: ['progetti'],   en: ['projects']    },
  about:    { it: ['about'],      en: ['about']       },
} as const
```

`app/[locale]/[[...segments]]/page.tsx` è l'**unica** rotta pubblica. Riceve `locale` e `segments`, chiama `resolveRoute(locale, segments)` e delega al modulo corrispondente in `views/`. Se `resolveRoute` restituisce `null` chiama `notFound()`, che rende `app/[locale]/not-found.tsx`: la 404 è localizzata per costruzione, con lo status HTTP corretto.

Questo elimina il middleware. Sei problemi cadono insieme: non serve produrre una 404 da un middleware (cosa che non renderebbe `not-found.tsx`), non c'è rewrite e quindi nessun mismatch di idratazione su `usePathname`, le Server Action non attraversano un rewrite, non c'è matcher da mantenere, le entry di cache sono chiavate sul percorso pubblico reale, e non si dipende dalla convenzione `middleware`/`proxy` che Next 16 ha rinominato.

`/it/gallery` non risolve — `gallery` non è nella colonna italiana — quindi 404. Nessun contenuto duplicato indicizzabile.

**Redirect `/` → `/it`**: in `next.config.ts`, `redirects()` con `permanent: true`. Questa forma è documentata come **308**; `NextResponse.redirect()` avrebbe prodotto un 307 (temporaneo, non cacheabile), che sull'URL più linkato del sito è il segnale SEO sbagliato. I redirect di configurazione sono inoltre valutati prima del filesystem.

**Validazione del locale**: `lib/i18n/locales.ts` esporta `LOCALES = ['it','en'] as const` e `isLocale(x): x is Locale`. Il layout chiama `notFound()` se `!isLocale(locale)`, così `/fr/qualunque-cosa` restituisce 404 invece di renderizzare con dizionario `undefined`.

**Generazione statica**: `generateStaticParams` enumera a build time tutte le combinazioni note, inclusi gli slug dei progetti pubblicati. `dynamicParams` resta al default `true`, così un progetto pubblicato dopo il build viene generato su richiesta invece di dare 404 fino al deploy successivo; la validazione dentro la catch-all garantisce comunque il 404 sui percorsi inesistenti.

`resolveRoute` e `alternatePaths(routeKey, params)` alimentano anche `canonical`, `hreflang` e il selettore lingua.

**Correzione dell'8 agosto 2026.** Una stesura precedente vietava `usePathname` nel selettore lingua, perché con i rewrite del middleware il percorso letto sul client differiva da quello reso sul server, producendo href sbagliati e un errore di idratazione. Quell'architettura è stata abbandonata in favore della catch-all (§4.2), quindi il percorso è ora quello pubblico reale e coincide fra server e client. Il selettore lo usa tramite `alternatePathsForPathname`, funzione pura e testata: l'header vive nel layout, che non riceve i segmenti della pagina figlia, e senza questo riporterebbe sempre alla home — contro la specifica di prodotto §6. Essendo reso anche in SSR, gli href restano corretti nell'HTML iniziale e funzionano senza JavaScript. Lo slug di progetto è identico nelle due lingue, quindi `alternatePaths` traduce solo prefisso di lingua e segmento.

### 4.3 Localizzazione dei contenuti

```ts
pickLocalized(field, locale) → { value: string, lang: Locale }
```

Restituisce il valore inglese se valorizzato e non composto di soli spazi, altrimenti quello italiano — **insieme alla lingua effettivamente usata**. La firma non può restituire una semplice stringa: un testo italiano dentro una pagina `lang="en"` non marcato viola WCAG 3.1.2 Language of Parts (livello AA), e poiché tutti i campi inglesi sono opzionali per specifica §5.1 e §5.2 questo è il caso normale, non un caso limite.

Ogni componente che rende un campo localizzato emette `lang={lang}` sull'elemento contenitore quando `lang !== locale`. Per gli alt text, che non possono portare un attributo proprio, è l'elemento immagine a ricevere `lang`.

Resta vero che al visitatore non viene mostrato alcun indicatore visibile di traduzione mancante: `lang` è un attributo, non testo.

Le etichette d'interfaccia stanno in `lib/i18n/dictionaries/`, non in Sanity.

## 5. Livello dati, cache e revalidation

### 5.1 Client e fetch

Due client, entrambi con `useCdn: false`:

```ts
// pubblico
createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: 'published' })
// anteprima
createClient({ projectId, dataset, apiVersion, useCdn: false,
               perspective: 'drafts', token: process.env.SANITY_API_READ_TOKEN })
```

`useCdn: false` sul client di anteprima è **obbligatorio**: la perspective `drafts` lo richiede. `useCdn: false` anche sul client pubblico è una scelta deliberata da non "ottimizzare" in seguito: con la revalidation per tag, il CDN Sanity può servire una risposta pre-pubblicazione subito dopo che il webhook ha scaduto la voce di cache, e Next ricacherebbe quel contenuto stale a tempo indeterminato — con i tag la scadenza a tempo è disattivata e nessun altro evento interverrebbe. La latenza della query si paga solo alla rigenerazione della pagina, non a ogni visita.

`lib/sanity/fetch.ts` espone un solo punto di accesso ai dati:

```ts
sanityFetch<const Q extends string>({ query, params, tags }: { query: Q; params?: QueryParams; tags?: string[] })
```

Il generico `const Q extends string` preserva il tipo letterale della query: senza, l'overload di `client.fetch` generato da TypeGen non si aggancia e ogni chiamata restituisce `any` — silenziosamente, perché `any` si propaga senza errori di compilazione.

La chiamata è completa:

```ts
client.fetch(query, params, { cache: 'force-cache', next: { tags, revalidate: false } })
```

`cache: 'force-cache'` è **necessario**: in Next il caching di `fetch` non è attivo per default e i tag da soli non sono un opt-in al Data Cache. Senza, nessuna risposta finisce in cache, `revalidateTag` non ha nulla da invalidare e ogni visita colpisce l'API Sanity — un fallimento invisibile in sviluppo che si manifesta solo in produzione. Tag e revalidation a tempo sono mutuamente esclusivi.

**Correzione del 9 agosto 2026, riprodotta in modo deterministico.** Questo design dava per scontato che un nuovo build rispecchiasse sempre lo stato corrente del dataset. Non è vero, e la causa è proprio `revalidate: false`. Next persiste le risposte di `fetch` in `.next/cache/fetch-cache` — nel sorgente di `FileSystemCache` il commento dichiara l'intento, "so it can be persisted across deploys" — e la chiave di cache è l'hash di URL, metodo, header e opzioni: **non contiene alcun identificativo del build**. Senza scadenza a tempo le voci restano valide a tempo indeterminato, quindi il build successivo le riusa e renderizza lo stato del dataset di *quando quelle voci sono state scritte*.

I tag non colmano il buco: `revalidateTag` scrive in un manifest tenuto in memoria dal processo server, che non sopravvive al build. Ne segue che una voce riusata da un build all'altro può solo essere più vecchia del dataset, mai più recente. Poiché Vercel ripristina la cache di build fra un deploy e l'altro, **ripubblicare non è un modo affidabile per aggiornare il contenuto**: misurato sul dataset `production`, un build con la cache calda produceva una sitemap con 8 `<loc>` e nessun progetto, e lo stesso build dopo `rm -rf .next/cache/fetch-cache` ne produceva 10 con `/it/progetti/concorso-trieste` e `/en/projects/concorso-trieste`.

Il rimedio non tocca la strategia di cache, che resta `force-cache` più tag: `next.config.ts` è una funzione della fase e, nella sola fase di build di produzione, elimina `.next/cache/fetch-cache` (vedi `scripts/build/fetchCache.ts`). La cache di Turbopack, accanto ad essa, va conservata: accelera la compilazione senza falsare i dati. Sta nella configurazione e non in uno script npm perché la configurazione viene caricata da `next build` comunque venga invocato. Il costo è una query Sanity per ogni query distinta del sito, una volta per build.

**`sanityFetch` non chiama mai `draftMode()`.** `draftMode` è una Dynamic API: se il punto di accesso unico ai dati la invocasse, ogni pagina del sito diventerebbe dinamica per tutti i visitatori, annullando l'intera strategia di cache. L'anteprima è isolata come descritto in §12.

Le query stanno in `lib/sanity/queries.ts`, scritte con `defineQuery` importato da `next-sanity`. Ogni query proietta solo i campi necessari e include sempre `asset->metadata.dimensions` e `asset->metadata.lqip`. I riferimenti opzionali vengono filtrati **prima** di essere dereferenziati, con `photos[defined(@->)]->{…}`.

**Correzione dell'8 agosto 2026, misurata sul dataset reale.** Una stesura precedente prescriveva `photos[]->{…}[defined(@)]`, cioè il filtro *dopo* la proiezione. Non è solo inefficace: restituisce un array di `null` anche quando tutti i riferimenti sono validi, perché a quel punto `@` è l'oggetto proiettato e il confronto avviene nel contesto sbagliato. Verificato su un progetto con sette fotografie tutte risolvibili: la forma precedente restituiva sette `null`, la pagina si sarebbe renderizzata vuota.

**TypeGen**: configurazione nel blocco `typegen` di `sanity.cli.ts` (il file `sanity-typegen.json` separato è deprecato), con `path: ['./lib/**/*.ts', './app/**/*.{ts,tsx}', './views/**/*.tsx', './components/**/*.tsx']` — i default puntano a `src/`, che questo repository non ha, e produrrebbero zero query trovate. `generates: './lib/sanity/types.generated.ts'`, che va incluso nell'array `include` di `tsconfig.json`. Due script npm: `sanity schema extract` poi `sanity typegen generate`, più uno step di CI che fallisce se i tipi generati differiscono da quelli committati.

### 5.2 Tag di cache

`photo:<id>`, `project:<id>`, `projects-index`, `gallery`, `home`, `about`, `settings`, `sitemap`.

**Le pagine di progetto dichiarano solo `project:<id>`, mai un tag per ogni fotografia.** Next limita a 128 il numero di tag per fetch: un progetto con più di ~125 scatti supererebbe il limite con comportamento non definito, e per un portfolio fotografico non è uno scenario esotico. Le dipendenze inverse sono risolte dal webhook (§5.3), non dai tag di pagina.

Le entry di cache sono chiavate sul percorso pubblico, perché non c'è alcun rewrite. `revalidatePath` resta comunque vietato in questo progetto: la revalidation avviene esclusivamente per tag, così la mappa delle dipendenze ha un solo punto di verità.

**Le rotte di metadati partecipano alla revalidation per tag** — verificato il 9 agosto 2026 su `next start`. `app/sitemap.ts` produce una voce di prerender come le pagine, e i suoi tag finiscono negli header dell'entry: `x-next-cache-tags: …,sitemap,projects-index`. Un webhook di progetto firmato ha portato `/sitemap.xml` da 14 a 16 `<loc>` senza rigenerare il build.

Va però annotato che `/sitemap.xml` **non** espone `x-nextjs-prerender`, mentre `/it/progetti` sì: è la differenza fra una rotta di App Router e una pagina, si osserva identica in locale, e non dice nulla sulla partecipazione ai tag. Non è quindi un indizio utilizzabile per diagnosticare una sitemap stantia.

### 5.3 Webhook

La proiezione GROQ configurata nel webhook Sanity è:

```groq
{ _id, _type, _rev,
  "slug": slug.current,
  "previousSlug": before().slug.current,
  "operation": delta::operation() }
```

**Le sotto-query sono vietate nelle proiezioni dei webhook** — documentazione Sanity: *"Sub-queries are not supported in webhook projections or filters... the recommended approach is to handle the sub-query in your receiving endpoint after the webhook fires."* La versione precedente di questo design vi fondava l'intera mappa delle dipendenze; era sbagliata.

Le dipendenze inverse sono quindi risolte lato ricevente. `lib/revalidation/tags.ts` si divide in due:

- `directTagsFor(payload)` — **funzione pura**: dal tipo di documento e dall'operazione produce i tag diretti, compresi quelli del vecchio percorso in caso di cambio slug. Testabile senza rete.
- `resolveDependentTags(payload, client)` — asincrona: se `_type === 'photo'`, esegue `*[_type in ["project","homePage"] && references($id)]._id` e produce i `project:<id>` corrispondenti più `home` se pertinente.

In alternativa `directTagsFor` accetta come secondo argomento la lista di id già risolta dal chiamante, restando pura e coprendo l'intero calcolo nei test.

`app/api/revalidate/route.ts`:

```ts
const signature = req.headers.get(SIGNATURE_HEADER_NAME)   // da @sanity/webhook
const body = await req.text()                              // UNA SOLA lettura del body
if (!signature || !(await isValidSignature(body, signature, secret)))
  return new Response(null, { status: 401 })
const payload = JSON.parse(body)
```

Tre dettagli che sono altrettanti bug quasi certi se non scritti:

1. **`isValidSignature` è asincrona** da `@sanity/webhook@4`. Senza `await`, la Promise è sempre truthy, la condizione non scatta mai e l'endpoint accetta qualunque richiesta: un bypass completo dell'autenticazione che nessun test del percorso felice rileva.
2. Il body di una Request Web si consuma una sola volta: `await request.text()` per la firma e poi `await request.json()` lancerebbe. Si legge il testo e si fa `JSON.parse`.
3. La firma va verificata sul corpo grezzo, mai su un JSON riserializzato.

Poi `revalidateTag(tag, { expire: 0 })` per ogni tag prodotto, e 200. In Next 16 la forma a un solo argomento è deprecata, e `{ expire: 0 }` è la forma raccomandata proprio per i webhook, che preserva la scadenza immediata attesa da questo design. `updateTag` non è utilizzabile: è chiamabile solo da Server Action, non da Route Handler.

L'operazione è idempotente perché produce un insieme di tag. Un fallimento non compromette la versione già pubblicata e la richiesta può essere ripetuta.

## 6. Pipeline immagini

Le immagini sono servite dal CDN di Sanity, non riottimizzate da Vercel.

**Configurazione delle larghezze.** Con un loader custom Next continua a decidere lui le larghezze del `srcset`, prendendole da `images.deviceSizes` e `images.imageSizes`. Vanno quindi configurate esplicitamente in `next.config.ts`, altrimenti Next chiede i suoi default (640, 750, 828, 1200, 2048…), più larghezze collassano sullo stesso URL arrotondato e il `srcset` finisce con voci duplicate e descrittori `w` che mentono sulla larghezza reale — bug silenzioso, non errore di build.

```ts
images: {
  loader: 'custom',
  loaderFile: './lib/sanity/imageLoader.ts',
  deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560, 3840],
  imageSizes: [320, 480],   // devono essere tutti < min(deviceSizes)
}
```

**Il file del loader è un modulo client.** Ha un unico default export `({ src, width, quality }) => string`, comincia con `'use client'`, e non importa nulla che tocchi variabili d'ambiente server o `lib/sanity/client.ts` — finirebbe nel bundle pubblico, in contrasto con §14. La costruzione degli URL condivisa con il server (Open Graph, sitemap) vive in `lib/sanity/imageUrl.ts`, modulo puro che il loader importa.

**Niente clamp alla larghezza nativa nel loader.** La firma del loader riceve solo `src`, `width` e `quality`: non ha accesso ai metadati Sanity. Il divieto di upscaling è garantito lato CDN da `fit=max` (*"Fit the image within the box you specify, but never scaling the image up"*). `snapWidth(w)` resta una pura funzione di arrotondamento sulla scala, ed è una rete di sicurezza, non la fonte delle larghezze.

**Eccezione per i crawler.** Gli URL destinati ai crawler — Open Graph, Twitter card — fissano il formato con `fm=jpg` e dimensioni esplicite (`w=1200&h=630&fit=crop`) e non passano dal loader di `next/image`.

**Correzione dell'8 agosto 2026, misurata.** La motivazione originaria era che `auto=format` avrebbe consegnato agli scraper un formato non renderizzabile. **Non è dimostrata**: il CDN Sanity serve webp soltanto se l'header `Accept` lo elenca esplicitamente, quindi `auto=format` restituisce comunque JPEG in tutti i casi provati: senza `Accept`, con un `Accept` permissivo e con lo user-agent di `facebookexternalhit` — byte identici a `fm=jpg`. La regola resta perché elimina la dipendenza dal comportamento di negoziazione del CDN, che può cambiare senza preavviso, ed è ciò che la documentazione Sanity raccomanda per le URL rivolte ai crawler: è una garanzia di determinismo, non la correzione di un guasto osservato.

`SanityImage` incapsula `next/image` e impone `sizes` obbligatorio, `aspect-ratio` dai metadati, `placeholder="blur"` con `blurDataURL` dal LQIP, `loading="lazy"` salvo priorità esplicita. **Passa `loader` esplicitamente come prop** invece di affidarsi al solo `loaderFile`: `loaderFile` è applicato come alias del compiler di Next, quindi non è attivo sotto Vitest, e i test di componente renderebbero URL prodotti dal loader di default — verdi su un comportamento inesistente in produzione.

Una sola immagine per pagina ha `priority`: sulla homepage la fotografia protagonista, altrove nessuna. Le varianti oltre 1920px sono richieste da hero, lightbox e dalle fotografie che il packer assegna da sole in una riga.

L'`hotspot` di Sanity è usato solo nella hero per adattamenti controllati su rapporti di schermo estremi. Galleria, progetti e lightbox non ritagliano mai.

Se un'immagine fallisce il caricamento, `SanityImage` mostra un riquadro neutro che conserva le dimensioni riservate e l'alt text.

## 7. Galleria a righe giustificate con packer server-side

### 7.1 Perché non in CSS puro

La versione precedente di questo design proponeva un layout flexbox puro. La verifica lo ha misurato in Chrome e ha trovato quattro difetti: senza `min-width: 0` un tile assume la larghezza intrinseca dell'immagine e sfonda la pagina; senza `align-items: flex-start` lo `stretch` di default deforma tutte le foto di una riga se una sola ha un rapporto discordante; lo pseudo-elemento che avrebbe dovuto assorbire l'ultima riga non vi entra quando c'è un `gap`, e su mobile non vi entra mai.

Il difetto decisivo è però un altro: `--row-height` non controlla l'altezza delle righe, entra solo nel criterio di andata a capo. L'altezza reale è `(W − gap·(n−1)) / Σar` e varia nell'intervallo [H, ~2H). Misurato: tre foto 16:9 in un contenitore da 1000px non entrano mai in due per riga (533 + 16 + 533 = 1082), quindi ogni 16:9 finisce da sola a tutta larghezza, alta il doppio del previsto. Per un fotografo di paesaggio è il caso normale. Il packer greedy di flexbox non ha lookahead e non può rimediare.

### 7.2 Il packer

`lib/gallery/packRows.ts` è una funzione pura:

```ts
packRows(items: { id: string; ar: number }[], K: number): Row[]
```

`K` è la somma dei rapporti d'aspetto verso cui tendere per riga: è il rapporto fra larghezza del contenitore e altezza di riga desiderata. Poiché il criterio è espresso in rapporti e non in pixel, **la composizione delle righe è indipendente dalla larghezza del viewport**: si calcola una volta sola lato server, dove i rapporti sono già noti da Sanity, e resta valida a ogni dimensione di schermo.

L'algoritmo accumula elementi finché aggiungerne un altro allontanerebbe `Σar` dal bersaglio `K` più di quanto lo avvicini, come fanno Flickr e Google Photos.

Valori iniziali, da tarare sul campione reale in Fase 1: `K = 2.8` sopra il breakpoint desktop, `K = 1.8` fra tablet e desktop. Breakpoint: mobile sotto 768px (colonna singola, packer non applicato), tablet 768–1199px, desktop da 1200px. Il contenitore della galleria ha `max-width: 1600px`. Poiché l'altezza di riga è `larghezza contenitore / Σar`, con `K = 2.8` scala da ~257px a 1200px di viewport fino a ~571px sul contenitore pieno: la crescita con lo schermo è voluta.

Il rendering è poi banale in CSS. Ogni riga è un flex container; ogni tile ha `flex: <ar> 1 0` — cioè `flex-basis: 0` e `flex-grow` proporzionale al rapporto — più `aspect-ratio: <ar>`, `min-width: 0` e `overflow: hidden`. La larghezza risulta `(W − gap) · ar_i / Σar` e l'altezza `(W − gap) / Σar`, identica per tutti gli elementi della riga, senza alcun ritaglio. La riga ha `align-items: flex-start`. L'immagine dentro il tile è `display: block; width: 100%; height: 100%; object-fit: cover` — con il rapporto corretto `cover` non ritaglia nulla, ma protegge da arrotondamenti sub-pixel.

`--ar` è emesso con precisione piena dai `dimensions` di Sanity, non arrotondato.

L'ultima riga non viene giustificata: ha `flex-grow: 0` e ogni tile `width: calc((100% - var(--gaps)) * var(--ar) / var(--K))`, che le dà la stessa altezza che avrebbe una riga piena, allineata a sinistra.

Sotto il breakpoint mobile la griglia è a colonna singola e il packer non si applica.

**Insiemi piccoli.** Con una o due fotografie l'ultima riga è anche l'unica: le immagini restano allineate a sinistra all'altezza nominale, con spazio vuoto a destra. È il comportamento voluto — le pagine di progetto con 2-4 scatti sono un caso normale e non devono stirare le foto a tutta larghezza.

**`sizes` diventa calcolabile.** `lib/gallery/sizes.ts` deriva per ogni tile la frazione di contenitore che occupa (`ar_i / Σar_riga`) e produce l'attributo `sizes` corretto in funzione dei breakpoint del contenitore. Con il CSS puro questo valore non era derivabile, perché dipendeva dalla composizione della riga, e sarebbe stato per forza un compromesso fra foto sgranate e megabyte sprecati.

### 7.3 Carica altre

La galleria mostra 24 elementi e ne aggiunge 24 per volta. Nessuno scroll infinito.

`loadMorePhotos(offset)` è una Server Action che restituisce il gruppo successivo **già impaccato in righe**, così l'append non ricalcola nulla e le righe già rese non si spostano. Ogni gruppo è un blocco di righe indipendente: le righe precedenti restano congelate, al prezzo di un'ultima riga non giustificata per gruppo, che è coerente con la scelta di §7.2.

Il contratto della Server Action è esplicito: restituisce `{ rows: Row[], hasMore: boolean, total: number }`. `hasMore` è come il client sa che non ci sono altre foto; non si deduce dal numero di elementi ricevuti.

**Comunicazione alle tecnologie assistive.** Nessun `aria-live` sul contenitore della griglia: il default `aria-relevant="additions text"` farebbe leggere gli alt text di tutte e 24 le nuove fotografie di seguito, senza possibilità di fermarli. Il pattern corretto è:

1. un elemento visualmente nascosto `role="status"` con testo breve dal dizionario — «Caricamento…» durante la richiesta, poi «24 fotografie aggiunte, 48 di 240 mostrate» — svuotato dopo l'annuncio;
2. all'arrivo del gruppo, il focus si sposta sulla **prima nuova fotografia**, altrimenti l'utente da tastiera è costretto a tabulare all'indietro per 24 elementi per riprendere da dove era;
3. sul pulsante `aria-disabled="true"` durante il caricamento, non `disabled`, per non perdere il focus;
4. in caso di errore il retry inline riceve il focus e il messaggio va nella stessa regione di stato.

Le fotografie già visibili restano al loro posto in caso di errore. Le fotografie con `showInGallery` disattivato sono escluse dalla query ma restano disponibili nei progetti.

## 8. Tema e token

`styles/tokens.css` dichiara i token in modo che la superficie scura sia **riutilizzabile**, non legata alla radice:

```css
:root, [data-theme='dark'], .surface-dark { /* token scuri */  color-scheme: dark; }
[data-theme='light']                       { /* token chiari */ color-scheme: light; }
```

Questo risolve una contraddizione della revisione precedente: con i token scuri solo su `:root` e gli override chiari su `[data-theme='light']`, la lightbox montata su `body` avrebbe ereditato i colori chiari nonostante §9 richieda che resti scura, producendo testo bianco su bianco. Ora la lightbox applica `.surface-dark` al proprio contenitore radice.

`color-scheme` è dichiarato **in CSS, non dallo script**. Se dipendesse dal JavaScript, al primo accesso — quando non c'è nulla in `localStorage` e lo script non scrive — resterebbe al default chiaro, e il browser disegnerebbe scrollbar e controlli nativi in chiaro sopra un fondo quasi nero, fuori dal controllo dei design token.

**Token di focus.** `--focus-ring` e `--focus-offset`, con una regola globale `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: var(--focus-offset) }` con contrasto ≥ 3:1 contro tutti e tre gli sfondi (scuro, chiaro, superficie lightbox). È vietato rimuovere `outline` in `reset.css`. WCAG 2.4.7 è livello AA e su un sito quasi nero con accenti minimi la scelta va fatta una volta e messa in un token.

**Token di target.** `--target-min: 44px`. Ogni controllo interattivo ha un'area di hit di almeno quella dimensione, ottenuta con padding o pseudo-elemento anche quando l'icona visibile è più piccola. WCAG 2.5.8 richiede 24px come minimo assoluto; i controlli a rischio sono proprio quelli che la specifica §7 vuole «discreti».

**Anti-flash.** Script inline sincrono nel `<head>` del root layout, non `next/script`. Tre requisiti che vanno scritti perché altrimenti il rimedio produce il difetto che doveva evitare:

- `<html>` è reso in JSX con il `data-theme` di default **e** `suppressHydrationWarning`. Senza, React tratta la differenza introdotta dallo script come hydration error e ricostruisce lato client dal boundary più vicino — cioè esattamente il flash che si voleva evitare.
- Lo script è emesso da un helper che usa `type="text/javascript"` sul server e `type="text/plain"` sul client, per il warning di React 19 sui tag `<script>` renderizzati.
- `ThemeToggle` riapplica l'attributo con `useLayoutEffect` (no-op in produzione): in Strict Mode React rimonta i componenti e azzera gli attributi di `<html>` non presenti nel JSX.

Se in futuro si introduce una CSP stretta, lo script inline richiede un nonce.

**`ThemeToggle`**: `<button aria-pressed={theme === 'light'}>` con nome accessibile **statico** dal dizionario («Tema chiaro» / «Light theme»), etichetta che non cambia con lo stato, icona `aria-hidden`. Un'etichetta dinamica e imperativa («Passa al tema chiaro») combinata con `aria-pressed` produce l'annuncio contraddittorio «Passa al tema chiaro, pulsante di attivazione, premuto».

`prefers-color-scheme` **non** viene consultato: il tema scuro è il default alla prima visita per scelta di prodotto (specifica §7). È una decisione consapevole con un costo per chi ha impostato il chiaro a livello di sistema, spesso per leggibilità.

`prefers-reduced-motion: reduce` disattiva dissolvenze e transizioni non essenziali tramite media query nei token, non con logica JavaScript.

## 9. Lightbox

Costruita su **`<dialog>` nativo** con `showModal()` e `close()` chiamati imperativamente in un effect, mai tramite il prop `open`.

La scelta sostituisce il focus trap fatto a mano della revisione precedente. Un trap su `keydown`/Tab intercetta solo la tabulazione: non impedisce al cursore virtuale degli screen reader di uscire dalla finestra, e l'APG richiede che il codice impedisca **ogni** interazione con il contenuto esterno. `showModal()` mette l'elemento nel top layer, rende inerte tutto il resto del documento a cura del browser, implica `aria-modal="true"`, gestisce Esc e fornisce `::backdrop` — cioè fa gratis e meglio ciò che il design si impegnava a scrivere e mantenere (elementi `disabled`, `tabindex=-1`, `visibility:hidden`, `<details>` chiusi, iframe).

Comportamenti:

- superficie sempre scura via `.surface-dark`, indipendente dal tema del sito
- **nome accessibile sempre presente**: `aria-labelledby` sul titolo quando c'è, altrimenti `aria-label` dal dizionario con la posizione («Fotografia 3 di 24»). Il titolo è opzionale per specifica §5.1, quindi una dialog anonima sarebbe il caso più frequente, non un caso limite
- `autofocus` sul pulsante di chiusura; nessun `tabindex` sulla dialog
- regione `role="status"` interna che annuncia la nuova posizione a ogni navigazione, altrimenti chi preme le frecce non riceve alcun riscontro
- immagine alla massima dimensione utile, mai ritagliata
- didascalia con titolo, anno e luogo, ciascuno solo se valorizzato, con `lang` quando il valore viene dal fallback italiano
- navigazione con pulsanti, frecce sinistra/destra e swipe; chiusura con pulsante, Esc e swipe verticale
- focus restituito all'elemento di origine alla chiusura
- precarico limitato a fotografia precedente e successiva
- URL della pagina invariato

**Blocco dello scroll, iOS incluso.** `overflow: hidden` su `body` non blocca lo scroll touch su iOS Safari, e `showModal()` non lo risolve: inertizzare il documento non impedisce lo scorrimento. Il design precedente compensava la larghezza della scrollbar — cioè risolveva il problema secondario, che su iOS è un no-op perché la scrollbar è overlay e larga zero. La soluzione è doppia: `scrollbar-gutter: stable` su `:root` come baseline senza JavaScript, più il blocco iOS-safe (salvataggio di `window.scrollY`, `position: fixed; top: -Ypx; width: 100%` su `body` all'apertura, ripristino esatto alla chiusura). Senza, durante lo swipe verticale di chiusura la pagina sotto continua a scorrere e alla chiusura l'utente si ritrova altrove nella galleria.

**Gesti.** `touch-action: pan-y pinch-zoom` sul contenitore immagine, per non eliminare il pinch-to-zoom, che è il meccanismo con cui un utente ipovedente ingrandisce la fotografia (WCAG 1.4.4). Listener `touchstart` non passivo con `preventDefault()` sui gesti che iniziano entro ~20px dal bordo laterale, per neutralizzare l'edge-swipe di iOS che altrimenti fa uscire dal sito invece di mostrare la foto precedente — questo richiede i `touchstart`, i Pointer Events da soli non bastano. Gestione di `pointercancel` e soglie distinte per orizzontale e verticale in base all'angolo dominante.

I pulsanti prev/next/chiudi esistono sempre, quindi WCAG 2.5.7 Dragging Movements e 2.5.1 Pointer Gestures sono soddisfatti: lo swipe non è mai l'unico modo di fare qualcosa.

La lightbox è condivisa fra galleria e pagine di progetto: riceve una sequenza di fotografie e un indice iniziale e non sa da dove viene.

## 10. Struttura semantica, SEO e metadati

**Semantica e tastiera** — requisiti della specifica §13 che la revisione precedente non copriva:

- un solo `<h1>` per pagina; nella galleria è il titolo della pagina, non una fotografia
- landmark `<header>`, `<nav>`, `<main>` (unico), `<footer>`
- **skip link** come primo elemento focalizzabile del `<body>`, etichetta dal dizionario. WCAG 2.4.1 Bypass Blocks è livello A e con header ripetuto più 24 elementi focalizzabili è il requisito più facilmente violato
- `PhotoTile` è un `<button>` nativo, non un `<div onClick>`: è la premessa perché il focus restore della lightbox e il focus management di «Carica altre» funzionino
- `MobileMenu` con `aria-expanded` e `aria-controls` sul trigger, chiusura con Esc, focus restituito al trigger
- `LocaleSwitcher`: due link, non un `<select>`; `aria-current` sulla lingua attiva; sul link verso l'altra lingua `hreflang` **e** `lang` con l'etichetta scritta nella lingua di destinazione («English» / «Italiano»), altrimenti «English» dentro una pagina italiana viene pronunciato con fonetica italiana

**Metadati.** `generateMetadata` nella catch-all produce titolo e descrizione localizzati con fallback a `siteSettings`, `alternates.canonical` sul percorso pubblico e `alternates.languages` con entrambe le lingue, e Open Graph con l'immagine social (formato fissato, §6).

`app/sitemap.ts` elenca entrambe le lingue di tutte le pagine pubbliche e dei progetti pubblicati. `app/robots.ts` esclude `/studio` e `/api`.

## 11. Sanity Studio

### 11.1 Struttura

`deskStructure.ts` espone cinque voci: Homepage, Fotografie, Progetti, About, Impostazioni. Homepage, About e Impostazioni sono singleton non duplicabili né eliminabili. Vision solo in sviluppo.

Le Fotografie usano `@sanity/orderable-document-list` per l'ordinamento con trascinamento.

**Limite di scala, riformulato.** Il plugin interroga tutti i documenti del tipo senza slice né limite, e rende ogni riga con un `<Preview>` (che scarica la thumbnail) più una sottoscrizione di stato per documento, senza virtualizzazione. A 500 fotografie lo Studio monta 500 anteprime e 500 sottoscrizioni in un solo pannello: il problema non è l'ergonomia del trascinamento come diceva la revisione precedente, è che il pannello può diventare inutilizzabile per tempo di primo render e memoria. Mitigazione: si fissa una soglia di **150 fotografie** oltre la quale si passa a un ordinamento per campo invece del trascinamento, e la si verifica nella passata di prestazioni della Fase 3 **con un seed da 500 documenti, non da 20**. Il parametro `filter` del plugin permetterebbe di spezzare la lista, ma il README avverte che i rank restano calcolati su tutti i documenti del tipo e liste filtrate diverse possono produrre risultati inattesi: non è una via sicura.

### 11.2 Schemi

Gli schemi seguono §5 della specifica di prodotto. Note implementative:

- i riferimenti da `project` e `homePage` verso `photo` sono **forti**
- campi bilingui raggruppati con `fieldsets` per lingua, italiano etichettato come fallback
- `slug` di progetto univoco e stabile, `isUnique` che considera bozze e pubblicati
- anno validato come intero in un intervallo dichiarato (1950–anno corrente)

**Conseguenza dei riferimenti forti che va comunicata al fotografo.** Un riferimento forte impedisce di eliminare il documento referenziato, ma lo stesso vincolo blocca anche l'**annullamento della pubblicazione**, perché unpublish comporta la cancellazione del documento pubblicato. Una fotografia usata in un progetto pubblicato non è quindi né eliminabile né spubblicabile finché il riferimento esiste, e il messaggio che Sanity mostra all'editor è generico. Il flusso corretto è: rimuovi la foto dal progetto, pubblica il progetto, poi elimina o spubblica la foto. Va documentato nella guida editoriale.

### 11.3 Riferimenti in bozza e pubblicazione

**Il blocco è nativo, non da implementare.** La documentazione Sanity è esplicita: con un riferimento forte *"the referring document will be blocked from publishing until the new, referenced, document has been published"*. Lo Studio lo realizza scrivendo il riferimento come debole con `_strengthenOnPublish` finché il target è solo bozza.

La revisione precedente si contraddiceva: §11.2 diceva che i riferimenti forti bastano, §11.3 dichiarava lo stesso requisito «non nativo» e prescriveva una document action.

La document action `publishWithDraftReferenceReport` resta in Fase 3 con uno scopo ridotto e onesto: **migliorare il messaggio**, elencando per titolo le fotografie ancora in bozza invece dell'errore generico. Specifiche:

- l'elenco va in un `dialog` aperto dalla action, non in un tooltip su un pulsante disabilitato: `disabled` accetta solo un booleano e il messaggio finirebbe in `title`, non raggiungibile da tastiera né annunciato dagli screen reader
- la action è invocata come React hook e non può essere async: la query si fa con `useState`/`useEffect`, e durante il caricamento la action è `disabled: true` con label che indica la verifica in corso — altrimenti c'è una finestra in cui risulta abilitata e l'editor pubblica aggirando il controllo
- il client si ottiene da `context.getClient({ apiVersion })` in `document.actions: (prev, context) => …`

Il test e2e verifica il **messaggio**, non il blocco: il blocco passerebbe anche senza la action.

### 11.4 Tool "Carica fotografie" (Fase 3)

Tool personalizzato dello Studio, non il normale campo immagine.

**Deduplica, con la garanzia reale.** Sanity crea un solo asset quando lo stesso file viene caricato più volte nello stesso dataset, anche con nomi diversi. Il meccanismo SHA1 non è documentato come contratto e non va citato come tale. Conseguenza da dichiarare: il rilevamento copre solo i re-upload dello **stesso file byte-identico**, non ri-esportazioni della stessa fotografia con impostazioni diverse — che è lo scenario reale di un fotografo. Rischio residuo registrato in §17.

Per ogni file, indipendentemente dagli altri:

1. carica l'asset con **`client.observable.assets.upload('image', file)`**, sottoscrivendo l'Observable e filtrando `event.type === 'progress'` per la percentuale e `event.type === 'response'` per il documento. La forma non-observable restituisce una Promise senza eventi di progresso: la barra di avanzamento richiesta dalla specifica non sarebbe implementabile. L'unsubscribe è anche il meccanismo di annullamento
2. cerca un `photo` esistente che referenzi l'asset, **con `client.withConfig({ perspective: 'raw' })`**. Il default è `published` per le versioni di API recenti: la query non vedrebbe mai le bozze che il tool stesso crea, e ricaricando lo stesso file si creerebbe una seconda bozza — esattamente ciò che il tool deve impedire. La deduplica considera sia `<id>` sia `drafts.<id>`
3. se esiste, segnala il duplicato e offre un collegamento al documento esistente
4. se non esiste, crea una **bozza** `photo` con `showInGallery` disattivato **e `orderRank` calcolato esplicitamente**
5. lascia alt text e metadati da completare

**`orderRank` va sempre scritto a mano nelle creazioni programmatiche.** Il plugin lo popola solo tramite `initialValue`, che gira unicamente quando il documento nasce dal form dello Studio. Una fotografia creata dal tool o dal seed nascerebbe senza rank: nello Studio appare al 20% di opacità e non è trascinabile finché un umano non lancia «Reset Order» a mano, e nella galleria pubblica finisce in una posizione arbitraria. `sanity/tools/upload/orderRank.ts` espone `nextOrderRank(client)` che interroga `*[_type == "photo"]|order(orderRank desc)[0].orderRank` e genera con `lexorank` il rank successivo. Vale identicamente per lo script di seed.

Il caricamento non pubblica mai automaticamente. Un fallimento parziale conserva le bozze riuscite ed elenca i file falliti con un retry che riguarda solo quelli.

`dedupe.ts`, `orderRank.ts` e la macchina a stati per file sono logica pura; `UploadTool.tsx` si limita a rendere lo stato.

## 12. Anteprima

L'anteprima è **isolata dalle rotte pubbliche**, che restano statiche. `sanityFetch` non chiama mai `draftMode()`; le rotte di anteprima vivono in un segmento dichiaratamente dinamico e usano il client con `perspective: 'drafts'`.

`draftMode()` è asincrona in Next 16: `const draft = await draftMode(); draft.enable()`.

La route di attivazione confronta il segreto a tempo costante e **risolve la destinazione da `ROUTES`**, mai reindirizzando a un valore arbitrario preso dalla query string: reindirizzare al parametro `slug` grezzo è un open redirect, e chiunque intercetti un link di anteprima potrebbe costruire un URL sul dominio del sito che rimanda altrove. Risponde 401 senza dettagli. Esiste una route gemella di disattivazione che chiama `draft.disable()`.

Con `perspective: 'drafts'` il campo `_id` non porta il prefisso `drafts.`; per distinguere bozza da pubblicato serve `_originalId`, disponibile solo con questa perspective — rilevante se l'anteprima deve segnalare visivamente cosa è in bozza.

*Da valutare in Fase 3:* `@sanity/preview-url-secret`, già dipendenza di `next-sanity`, offre segreti a rotazione al posto di un segreto statico che finisce nei log e nella cronologia del browser e non è revocabile per utente. La decisione va registrata.

## 13. Resilienza

- Fallimento di una richiesta Sanity durante la navigazione: resta servito il contenuto statico più recente.
- Riferimento opzionale non disponibile: l'elemento è omesso, la pagina non si rompe. Le query filtrano i riferimenti prima di dereferenziarli, con `photos[defined(@->)]->{…}`.
- Immagine non caricabile: riquadro neutro con alt text e dimensioni preservate.
- Traduzione inglese mancante: italiano, marcato con `lang="it"`.
- Preferenza tema illeggibile: tema scuro.
- Fallimento di un gruppo della galleria: retry inline, elementi già visibili intatti.
- Fallimento parziale di un caricamento multiplo: retry selettivo.
- Fotografia referenziata che l'editor tenta di eliminare o spubblicare: bloccata da Sanity; il flusso corretto è documentato in §11.2.
- Errori inattesi: error boundary coerenti con il design, con tentativo di ricaricamento.
- Webhook senza firma valida: 401 senza dettagli.

## 14. Sicurezza

Token di anteprima e segreto webhook solo in variabili d'ambiente server-side. Nessun token con permessi di scrittura nel bundle pubblico — in particolare il file del loader immagini, che è un modulo client, non importa nulla che tocchi `lib/sanity/client.ts`. CORS Sanity limitato alle origini necessarie. Firme validate prima di ogni revalidation. Testi da Sanity renderizzati come testo, mai come HTML. Nessuna analytics e nessun cookie non essenziale.

| Variabile | Lato | Uso |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | pubblico | client di lettura e Studio |
| `NEXT_PUBLIC_SANITY_DATASET` | pubblico | client di lettura e Studio |
| `NEXT_PUBLIC_SANITY_API_VERSION` | pubblico | versione API bloccata a una data |
| `NEXT_PUBLIC_SITE_URL` | pubblico | canonical, hreflang, sitemap |
| `SANITY_API_READ_TOKEN` | server | lettura bozze in anteprima |
| `SANITY_REVALIDATE_SECRET` | server | verifica firma webhook |
| `SANITY_PREVIEW_SECRET` | server | attivazione draft mode |
| `SANITY_E2E_AUTH_TOKEN` | server, solo CI | autenticazione Studio negli e2e |

`.env.example` è versionato; `.env.local` e `storageState.json` no.

**Nota sul piano Sanity, verificata il 7 agosto 2026**: il piano gratuito consente **due** dataset. La creazione di un terzo (`e2e`) è stata rifiutata con «Quota exceeded», quindi gli end-to-end girano su `development` insieme al lavoro di sviluppo. L'isolamento resta affidato alle due misure di §15.4 — worker singolo e documenti con `_id` prefissato per esecuzione, eliminati in teardown — con il rischio residuo che un test interrotto a metà lasci documenti orfani nel dataset di sviluppo.

Sul piano gratuito i dataset sono inoltre **pubblici**: `development` è leggibile da chiunque conosca il project id. Le restrizioni CORS non lo proteggono, perché CORS non è un controllo di accesso server-side. Non vanno quindi messi in `development` contenuti che non siano placeholder o materiale già destinato alla pubblicazione.

## 15. Test

### 15.1 Ripartizione

Vitest con jsdom copre funzioni pure, Client Components e **Server Components sincroni** — che sono testabili, contrariamente a quanto affermava la revisione precedente. Solo i Server Components **async** non sono resi da Vitest, limite documentato da Next.js: la loro logica di fetch è estratta in funzioni pure e il loro rendering è coperto dagli e2e.

`vitest.config.mts` include `tsconfigPaths()` e `react()`, `environment: 'jsdom'`. `vitest.setup.ts` dichiara `vi.mock('next/cache')`, `vi.mock('next/headers')` e il mock di `lib/sanity/fetch.ts`, così le Server Action sono testabili senza rete.

### 15.2 Unit

`pickLocalized` (compreso il ritorno della lingua e il caso stringa inglese di soli spazi), `isLocale`, `resolveRoute` e `alternatePaths`, mapping dei documenti Sanity, `snapWidth` e costruzione degli URL immagine, accordo fra la scala di larghezze e `deviceSizes`, presenza di `fm=` e assenza di `auto=format` negli URL per crawler, `packRows` (righe piene, ultima riga, elemento singolo, rapporti estremi), `sizesForTile`, `directTagsFor` per ogni tipo di documento e per cambio slug, annullamento pubblicazione ed eliminazione, `findDuplicatePhoto` (compreso «asset referenziato solo da una bozza»), `nextOrderRank`, selezione dei contenuti pubblicabili.

Server Action `loadMorePhotos`: offset e limite ai confini (0, 24, ultimo gruppo parziale, offset oltre il totale) e propagazione dell'errore.

Route handler `POST /api/revalidate`: **firma assente, malformata e non corrispondente devono dare 401**. È il test che rivela il bug del mancato `await`, invisibile nel percorso felice.

### 15.3 Componenti

Header desktop e mobile, `ThemeToggle` e persistenza, `LocaleSwitcher`, `PhotoGrid` e `LoadMoreButton` (stato, regione di stato, spostamento del focus), lightbox (nome accessibile con e senza titolo, tastiera, controlli), avanzamento/errore parziale/retry del caricamento multiplo, stati vuoti ed errore.

I componenti che rendono immagini passano `loader` esplicitamente (§6): il `loaderFile` di `next.config` non è attivo sotto Vitest.

### 15.4 End-to-end

Playwright contro il dataset `development`, condiviso con lo sviluppo perché il piano gratuito non consente un terzo dataset (§14).

**Isolamento.** Poiché il dataset è condiviso, le due misure seguenti non sono un di più ma l'unica cosa che tiene separati i test dal lavoro di sviluppo. `workers: 1` e `fullyParallel: false` per la suite che tocca Sanity. Ogni test di scrittura crea documenti con `_id` prefissato univoco (`e2e.<runId>.<n>`) e li elimina in un fixture di teardown, invece di riusare i documenti del seed. Il prefisso `e2e.` rende inoltre banale ripulire a mano gli orfani lasciati da un'esecuzione interrotta. Senza questo, i test che pubblicano lasciano stato che altera l'esito degli altri: «blocco della pubblicazione» smetterebbe di fallire dopo la prima esecuzione e il test sui duplicati passerebbe solo dalla seconda.

**Autenticazione dello Studio.** Un progetto Playwright `setup` inietta il token di un utente di servizio in `localStorage['__sanity_auth_token_<projectId>']` e salva `storageState`; gli altri progetti lo riusano. Senza questo, tre e2e su dodici non sono implementabili e chi implementa la Fase 3 si trova davanti alla schermata di login SSO.

**Revalidation, spezzata in due.** Il webhook Sanity è una richiesta HTTP in uscita dai server Sanity e non può raggiungere `localhost`; inoltre la Data Cache esiste solo in un build di produzione, quindi un test contro `next dev` passerebbe anche con `revalidateTag` mai chiamata. Quindi: (a) test di integrazione del route handler in Vitest, che costruisce una firma HMAC valida e verifica 401 e le chiamate a `revalidateTag`, senza rete; (b) test e2e reale contro una **preview deployment Vercel**, con URL pubblico raggiungibile dal webhook, con polling esplicito perché l'invalidazione si materializza alla visita successiva. In locale serve un tunnel; il pannello webhook di Sanity permette il replay di una consegna.

**Touch.** La classe `Touchscreen` di Playwright è limitata al tap, e i `TouchEvent` dispatchati via DOM non generano i corrispondenti Pointer Events. Per il gesto si usa `page.mouse.move/down/up`, che produce pointer event trusted e copre la logica di `useSwipe`. Per il touch reale su Chromium si valuta `Input.dispatchTouchEvent` via CDP — *strada non confermata dalla documentazione Playwright, da provare in Fase 1 prima di impegnarsi sul requisito.*

Casi coperti: navigazione completa IT/EN, lightbox con mouse, tastiera e touch, persistenza del tema fra navigazioni e ricaricamenti, caricamento incrementale della galleria, apertura dei progetti e ordine corretto, messaggio di blocco della pubblicazione con riferimenti in bozza, caricamento multiplo con duplicati ed errore parziale, anteprima bozza autenticata, revalidation, 404 localizzate, href del selettore lingua nell'HTML sorgente senza JavaScript, `scrollY` identico prima dell'apertura e dopo la chiusura della lightbox su emulazione iPhone.

### 15.5 Accessibilità automatica

`@axe-core/playwright` su homepage, galleria (prima e dopo «Carica altre»), progetto, About e 404, in entrambe le lingue e in **entrambi i temi**, più uno scan con la lightbox aperta. `vitest-axe` sui componenti di §15.3.

Nessuna suite automatica sostituisce la prova con screen reader, ma fissa una soglia oggettiva. Il checkpoint di accessibilità delle parti costruite in Fase 1 si verifica **in Fase 1**, non rimandato in blocco alla Fase 3.

### 15.6 Seed

`generatePlaceholders.ts` produce con `sharp` immagini di rapporti misti (16:9, 3:2, 2:3, 4:5, 1:1) in sRGB, lato lungo entro 4000px. `seedDataset.ts` le carica e crea fotografie **con `orderRank` esplicito**, due progetti, homepage, about e impostazioni.

Il dataset di destinazione è un parametro obbligatorio, mai un default: `development` per lo sviluppo quotidiano e per la suite Playwright, **mai `production`**. Lo script rifiuta `production` esplicitamente. È idempotente: rieseguirlo non duplica documenti. Esiste una modalità che genera 500 documenti, usata per la verifica di scala dello Studio (§11.1).

I placeholder servono a sviluppare e testare i layout. **Non sostituiscono la verifica manuale della qualità fotografica** richiesta dalla specifica §16.

## 16. Fasi di consegna

### Fase 1 — Fondamenta e galleria

Repository, toolchain e versioni pinnate, Node 24, progetto Sanity e tre dataset, `.env.example`, design token (compresi focus e target) e tema anti-flash, routing con catch-all e dizionario, schemi Sanity completi, Studio con desk structure e ordinamento, `SanityImage` e pipeline immagini, homepage con fotografia protagonista, `packRows` e galleria a righe giustificate con «Carica altre», lightbox su `<dialog>`, script di seed, test unitari e di componenti delle parti sopra, scan axe delle pagine costruite.

Verifiche obbligatorie del checkpoint, non assunzioni: `next build && next start` mostra le rotte come prerenderizzate; l'header `x-nextjs-cache` su una pagina pubblica è `HIT` e non `MISS` a ogni richiesta; il gesto touch della lightbox è pilotabile da Playwright con la strada scelta in §15.4.

### Fase 2 — Progetti, SEO, revalidation

**Riallineamento dell'8 agosto 2026.** Tre voci previste qui sono già state consegnate fuori ordine: le 404 localizzate e l'error boundary in Fase 1A, la pagina **About** su richiesta diretta dopo la Fase 1B. Un titolo localizzato minimo è già in Fase 1A, perché senza di esso il sito non emetteva alcun `<title>` — WCAG 2.4.2, livello A.

Resta quindi: indice e pagina di progetto, `generateMetadata` completa con canonical, `hreflang` e Open Graph, sitemap, robots, webhook firmato con `directTagsFor` più risoluzione delle dipendenze inverse, stati di resilienza, test relativi.

**Prerequisiti di dataset, oggi non soddisfatti:** nessun documento `project` è seminato, quindi le pagine progetto non avrebbero contenuto da rendere; e `siteSettings.socialImage` non è valorizzata, pur essendo obbligatoria per la pubblicazione e necessaria alle anteprime social. Entrambi vanno coperti dal seed prima che i checkpoint di questa fase siano verificabili.

Checkpoint: tutte le pagine pubbliche esistono in entrambe le lingue; la pubblicazione aggiorna solo le pagine coinvolte, verificato sulla preview deployment e non in locale; metadati e anteprime social corretti.

### Fase 3 — Studio avanzato e verifica

Tool «Carica fotografie», document action con il report delle bozze, modalità anteprima autenticata, suite e2e completa con autenticazione Studio, passata di accessibilità con tastiera e screen reader, passata di prestazioni sui Core Web Vitals, verifica di scala dello Studio con 500 documenti, verifica dei contrasti in entrambi i temi.

Checkpoint: i criteri di accettazione della specifica §17 sono soddisfatti, con l'eccezione dichiarata della verifica su fotografie reali.

## 17. Rischi noti

**Ordinamento manuale su cataloghi grandi.** Non è un problema di ergonomia ma di rendering: il plugin monta un'anteprima e una sottoscrizione per ogni documento senza virtualizzazione. Soglia fissata a 150 fotografie, da verificare con un seed da 500 in Fase 3.

**Duplicati visivi non rilevabili.** La deduplica copre solo file byte-identici. La stessa fotografia riesportata con impostazioni diverse produce un asset nuovo e non viene segnalata — ed è lo scenario reale di un fotografo che riesporta da Lightroom.

**Qualità di compressione.** La specifica §11 chiede un confronto visivo su un campione rappresentativo. Con soli placeholder non è possibile: in Fase 1 si fissa un valore prudente (85) e lo si tara alla prima consegna di fotografie reali.

**Verifica di accettazione incompleta senza foto reali.** I criteri §17.6 e §17.9 sulla qualità fotografica non sono dichiarabili soddisfatti finché il catalogo contiene solo placeholder.

**Tema scuro forzato al primo accesso.** `prefers-color-scheme` non è consultato, per scelta di prodotto. Ha un costo per chi ha impostato il tema chiaro a livello di sistema per motivi di leggibilità.

**Touch negli e2e.** La copertura del gesto touch reale dipende da una strada non confermata dalla documentazione Playwright. Se in Fase 1 non regge, il requisito «lightbox utilizzabile con touch» resta verificato solo manualmente e va detto.

## 18. Cosa resta fuori

Vale integralmente l'ambito escluso dalla specifica §2: niente e-commerce, prenotazioni, area clienti, commenti, account, newsletter, ricerca full-text, filtri, tassonomie, EXIF pubblico, download degli originali, watermark, caroselli, video. Nessuno di questi va introdotto «perché costa poco».
