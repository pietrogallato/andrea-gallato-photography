# Andrea Gallato Photography

Portfolio fotografico bilingue per Andrea Gallato: un'esperienza scura, essenziale ed editoriale, con contenuti gestiti in Sanity.

## Funzionalità

- Home fotografica, galleria con caricamento incrementale, progetti e pagina About.
- Lightbox accessibile per le fotografie e cambio lingua che conserva la pagina equivalente in italiano o inglese.
- Sanity Studio incorporato, anteprima protetta delle bozze e revalidation selettiva dopo la pubblicazione.
- SEO localizzato: metadati, canonical, Open Graph, sitemap e robots.

## Stack

- Node.js 24, Next.js 16, React 19 e TypeScript.
- Sanity come CMS e Content Lake; gli asset fotografici sono distribuiti tramite la CDN di Sanity.
- CSS Modules per gli stili.
- Vitest e Testing Library per i test unitari e dei componenti; Playwright e axe per E2E e accessibilità.

## Architettura

Il routing catch-all bilingue risolve le pagine pubbliche sotto `app/[locale]/[[...segments]]`; le pagine sono Server Components e il codice client è limitato alle interazioni. Sanity funge da CMS e Content Lake: Next.js gestisce la cache pubblica taggata dei contenuti strutturati, mentre gli asset fotografici sono distribuiti tramite la CDN di Sanity. L'anteprima delle bozze usa `no-store`; un webhook firmato da Sanity invalida soltanto i tag interessati.

## Prerequisiti

- Node.js 24.x
- npm

Il repository usa `package-lock.json`; `.npmrc` impone inoltre `engine-strict=true`, quindi una versione di Node non compatibile interrompe l'installazione.

## Avvio locale

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Aprire [http://localhost:3000/it](http://localhost:3000/it) per il sito e [http://localhost:3000/studio](http://localhost:3000/studio) per Sanity Studio. Compilare `.env.local` prima di usare Studio o le integrazioni Sanity.

## Variabili d'ambiente

| Variabile | Uso |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Necessaria al collegamento con il progetto Sanity. |
| `NEXT_PUBLIC_SANITY_DATASET` | Necessaria al collegamento con il dataset Sanity. |
| `NEXT_PUBLIC_SANITY_API_VERSION` | Necessaria al collegamento con la versione API Sanity. |
| `NEXT_PUBLIC_SITE_URL` | Opzionale in locale; definisce una base esplicita per canonical, sitemap e Open Graph. |
| `SANITY_API_READ_TOKEN` | Consente la lettura delle bozze nell'anteprima. |
| `SANITY_REVALIDATE_SECRET` | Verifica la firma del webhook di revalidation. |
| `SANITY_PREVIEW_SECRET` | Attiva l'anteprima protetta. |
| `SANITY_WRITE_TOKEN` | Usato solo dagli script locali di seed e upload; non deve mai essere pubblico. |
| `SANITY_E2E_AUTH_TOKEN` | Opzionale: abilita la suite E2E autenticata dello Studio. |

Non esporre token o segreti con il prefisso `NEXT_PUBLIC_`.

## Rotte

| Percorso | Descrizione |
| --- | --- |
| `/` | Reindirizza a `/it`. |
| `/it`, `/en` | Home nelle due lingue. |
| `/it/fotografie`, `/en/photographs` | Galleria fotografica. |
| `/it/progetti`, `/en/projects` | Indice dei progetti; i dettagli usano lo slug dopo questo segmento. |
| `/it/about`, `/en/about` | Pagina About. |
| `/studio` | Sanity Studio incorporato. |
| `/sitemap.xml` | Sitemap localizzata. |
| `/robots.txt` | Istruzioni per i crawler. |
| `/api/preview/enable`, `/api/preview/disable` | Endpoint per attivare e disattivare l'anteprima. |
| `/api/revalidate` | Endpoint del webhook firmato per la revalidation selettiva. |

## Script

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia Next.js in sviluppo. |
| `npm run build` | Crea il build di produzione. |
| `npm run start` | Avvia il server del build di produzione. |
| `npm run typecheck` | Esegue `tsc --noEmit`. |
| `npm test` | Esegue Vitest una volta. |
| `npm run test:watch` | Avvia Vitest in watch mode. |
| `npm run e2e` | Esegue Playwright; avvia autonomamente build e server necessari. |
| `npm run sanity:extract` | Estrae lo schema Sanity in `schema.json`. |
| `npm run sanity:typegen` | Estrae lo schema e genera i tipi Sanity. |
| `npm run seed` | Popola il dataset indicato da `SEED_DATASET`; richiede le variabili esportate nell'ambiente. |
| `npm run upload:photos` | Carica fotografie leggendo `.env.local`. |
| `npm run upload:project` | Carica un progetto leggendo `.env.local`. |
| `npm run scala:crea` | Crea i contenuti della scala tramite script locale. |
| `npm run scala:rimuovi` | Rimuove i contenuti della scala tramite script locale. |

## Contenuti e pubblicazione

Lo Studio gestisce cinque tipi editoriali: Homepage, Fotografie, Progetti, About e Impostazioni. Per ogni testo l'inglese ricade sull'italiano quando non è compilato. Le fotografie possono essere caricate in multiplo, riordinate e riutilizzate nei progetti.

Le bozze restano non pubbliche e si consultano solo attraverso l'anteprima protetta. Alla pubblicazione, il webhook invalida selettivamente le cache correlate a contenuto, indice o impostazioni, senza svuotare l'intera cache.

## Test e qualità

- `npm test` verifica unità e componenti con Vitest e Testing Library.
- `npm run e2e` copre Chromium, WebKit e iPhone, oltre al progetto Playwright `dev` per i comportamenti di sviluppo.
- I controlli di accessibilità usano axe.
- `npm run typecheck` verifica TypeScript; `npm run build` verifica il build di produzione.

## Struttura del repository

```text
app/         routing Next.js, route handler e Studio
views/       composizione delle pagine
components/  componenti UI e layout
lib/         Sanity, i18n, SEO e utilità applicative
sanity/      schema, struttura e strumenti del CMS
scripts/     seed, upload e attività di build
e2e/         test end-to-end Playwright
styles/      stili condivisi e moduli CSS
docs/        guide operative e protocolli di verifica
```

## Deploy

Il deploy è previsto su Vercel: configurare le variabili d'ambiente, autorizzare l'origine Vercel nel CORS di Sanity e configurare il webhook firmato verso `/api/revalidate`. Per la procedura completa, vedere [docs/deploy-vercel.md](docs/deploy-vercel.md).

## Documentazione

- [Guida al sito per Andrea](docs/guida-per-andrea.md)
- [Deploy su Vercel](docs/deploy-vercel.md)
- [Design del portfolio fotografico](portfolio-fotografico-design.md)
- [Protocolli di verifiche manuali](docs/verifiche/protocolli-verifiche-manuali.md)
