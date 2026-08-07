# Fase 1A — Fondamenta e navigazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire le fondamenta del portfolio: un sito bilingue navigabile con tema persistente e 404 localizzate, uno Studio Sanity funzionante con i cinque tipi di documento e l'ordinamento manuale, e un dataset di sviluppo popolato di placeholder.

**Architecture:** Progetto Next.js 16 singolo con App Router. `app/[locale]/layout.tsx` è il root layout (definisce `<html lang>`), e `app/[locale]/[[...segments]]/page.tsx` è l'unica rotta pubblica: risolve il percorso da un dizionario in `lib/i18n/routes.ts` e delega a un modulo in `views/`. Nessun middleware. Sanity Studio è montato a `/studio` con un proprio root layout isolato. Tutta la logica decidibile (fallback lingua, risoluzione percorsi, calcolo del rank di ordinamento) è in funzioni pure sotto `lib/`, testate senza React e senza rete.

**Tech Stack:** Next 16.3, React 19.2, TypeScript strict, Sanity 6.9, next-sanity 13.3, CSS Modules + custom properties, Vitest + Testing Library, Playwright, Node 24 LTS.

**Documenti normativi:**
- [Design implementativo](../specs/2026-08-07-portfolio-fotografico-design.md) — normativo per le scelte tecniche
- [Specifica di prodotto](../../../portfolio-fotografico-design.md) — normativa per i requisiti funzionali

**Fuori ambito in 1A** (vanno nel piano 1B): pipeline immagini, `packRows`, galleria, «Carica altre», lightbox, hero della homepage. In 1A nessuna fotografia viene renderizzata sul sito pubblico.

**Decisione di fasatura da registrare:** in Fase 1 l'header linka soltanto **Fotografie**. Le voci Progetti e About compaiono in Fase 2 insieme alle rispettive pagine, così la navigazione non punta mai a una 404. Le loro chiavi esistono già nel dizionario dei percorsi perché servono a `alternatePaths` e ai test.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `package.json`, `.nvmrc`, `tsconfig.json`, `next.config.ts` | Toolchain, versioni pinnate, redirect `/` → `/it`, configurazione immagini |
| `vitest.config.mts`, `vitest.setup.ts` | Ambiente jsdom, alias TS, mock delle primitive Next |
| `playwright.config.ts` | Suite e2e, worker singolo per i test che toccano Sanity |
| `styles/tokens.css` | Design token: colori, spazi, tipografia, focus, target, `color-scheme` |
| `styles/reset.css` | Reset minimo. **Non rimuove mai `outline`** |
| `lib/i18n/locales.ts` | `LOCALES`, tipo `Locale`, `isLocale` |
| `lib/i18n/routes.ts` | Dizionario percorsi, `resolveRoute`, `pathFor`, `alternatePaths` |
| `lib/i18n/localize.ts` | `pickLocalized` — restituisce valore **e lingua vinta** |
| `lib/i18n/dictionaries/{it,en}.ts` | Etichette d'interfaccia |
| `lib/theme/script.ts` | Chiave di storage e sorgente dello script anti-flash |
| `lib/sanity/client.ts` | Client pubblico e client di anteprima |
| `lib/sanity/fetch.ts` | `sanityFetch`, unico punto di accesso ai dati |
| `lib/sanity/queries.ts` | Query GROQ con `defineQuery` |
| `app/[locale]/layout.tsx` | **Root layout**: `<html lang>`, `<body>`, script tema, header, footer |
| `app/[locale]/[[...segments]]/page.tsx` | Catch-all: risolve la rotta e delega a `views/` |
| `app/[locale]/not-found.tsx` | 404 localizzata |
| `app/studio/layout.tsx`, `app/studio/[[...tool]]/page.tsx` | Studio isolato |
| `views/HomeView.tsx` | Homepage (in 1A: solo testo introduttivo) |
| `components/layout/*` | `SkipLink`, `Header`, `Footer`, `MobileMenu` |
| `components/controls/*` | `ThemeToggle`, `LocaleSwitcher` |
| `sanity/schemas/*` | I cinque tipi di documento |
| `sanity/structure/deskStructure.ts` | Le cinque voci, singleton non duplicabili |
| `sanity/lib/orderRank.ts` | `nextOrderRank` — usato da seed e, in Fase 3, dal tool di upload |
| `scripts/seed/*` | Generazione placeholder e popolamento dataset |

---

## Task 1: Inizializzare repository e toolchain

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`

- [ ] **Step 1: Verificare e attivare Node 24**

```bash
node --version
```

Se non è `v24.x`, installarlo e attivarlo prima di proseguire. Node 25 è EOL da giugno 2026 e Vercel non lo offre; con Node 25 npm degrada silenziosamente alcune dipendenze (jsdom 29 invece di 30) producendo un lockfile diverso da quello di produzione.

```bash
echo "24" > .nvmrc
```

- [ ] **Step 2: Creare `package.json`**

```json
{
  "name": "andrea-gallato-photography",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "sanity:extract": "sanity schema extract --path=./schema.json",
    "sanity:typegen": "npm run sanity:extract && sanity typegen generate",
    "seed": "tsx scripts/seed/seedDataset.ts"
  }
}
```

- [ ] **Step 3: Installare le dipendenze alle versioni del design §2**

```bash
npm install next@^16.3 react@^19.2.3 react-dom@^19.2.3 sanity@^6.9 next-sanity@^13.3 @sanity/client@^7.26 @sanity/image-url@^2 @sanity/webhook@^4 @sanity/orderable-document-list@^2 styled-components@^6.1 lexorank
```

```bash
npm install -D typescript @types/node @types/react @types/react-dom vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths @playwright/test @axe-core/playwright vitest-axe sharp tsx
```

`styled-components` è peer obbligatorio di `sanity` per lo Studio embedded: senza, lo Studio non parte. `@testing-library/dom` è peer esplicito di Testing Library dalla v16 e non è più incluso. `vite-tsconfig-paths` serve a risolvere gli alias TypeScript nei test.

- [ ] **Step 4: Verificare che l'installazione sia pulita**

```bash
npm ls next next-sanity sanity react
```

Atteso: nessun `UNMET PEER DEPENDENCY`, nessun `invalid`. Se compare un errore `ERESOLVE`, **non** usare `--legacy-peer-deps`: significa che le versioni non sono coerenti e va corretta la matrice, non silenziato l'errore.

- [ ] **Step 5: Creare `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "lib/sanity/types.generated.ts"
  ],
  "exclude": ["node_modules"]
}
```

`lib/sanity/types.generated.ts` deve stare in `include`, altrimenti TypeScript non usa i tipi generati da TypeGen e ogni query restituisce `any` senza alcun errore di compilazione.

- [ ] **Step 6: Creare `.gitignore`**

```
node_modules/
.next/
out/
*.tsbuildinfo
.env.local
.env*.local
schema.json
lib/sanity/types.generated.ts
e2e/.auth/
playwright-report/
test-results/
scripts/seed/generated/
.DS_Store
```

`*.tsbuildinfo` è necessario perché `incremental: true` in `tsconfig.json` fa scrivere a `tsc --noEmit` una cache di ~117 KB alla radice a ogni typecheck: senza la regola, ogni `git add -A` la ricommitterebbe.

`next-env.d.ts` è invece **tracciato** di proposito. Al primo `next dev` o `next build` con un albero di rotte esistente, Next lo riscrive con un contenuto più ampio di quello iniziale: è una modifica attesa una volta sola, non un errore.

- [ ] **Step 7: Creare `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/', destination: '/it', permanent: true },
  ],
}

export default nextConfig
```

`permanent: true` produce un **308**. `NextResponse.redirect()` avrebbe prodotto un 307 temporaneo e non cacheabile, che sull'URL più linkato del sito è il segnale SEO sbagliato. La configurazione delle immagini viene aggiunta nel piano 1B, insieme al loader.

- [ ] **Step 8: Verificare che il progetto compili**

```bash
npm run typecheck
```

Atteso: nessun errore. (`next-env.d.ts` viene generato al primo `next dev`/`next build`; se `typecheck` si lamenta della sua assenza, eseguire prima `npx next build --no-lint` o crearlo con il contenuto standard di due righe di reference.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: inizializza toolchain Next 16 su Node 24"
```

---

## Task 2: Configurare Vitest

**Files:**
- Create: `vitest.config.mts`, `vitest.setup.ts`, `lib/i18n/__tests__/smoke.test.ts`

- [ ] **Step 1: Creare `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 2: Creare `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  draftMode: vi.fn(async () => ({ isEnabled: false, enable: vi.fn(), disable: vi.fn() })),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  usePathname: vi.fn(() => '/it'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))
```

Il mock di `notFound` che lancia permette ai test di asserire che una rotta non risolve, con `expect(() => …).toThrow('NEXT_NOT_FOUND')`.

- [ ] **Step 3: Installare `@testing-library/jest-dom`**

```bash
npm install -D @testing-library/jest-dom
```

- [ ] **Step 4: Scrivere un test di fumo che deve fallire**

```ts
// lib/i18n/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ambiente di test', () => {
  it('rende JSX e trova il testo', () => {
    render(<p>ciao</p>)
    expect(screen.getByText('ciao')).toBeInTheDocument()
  })
})
```

Rinominare il file in `smoke.test.tsx` perché contiene JSX.

- [ ] **Step 5: Eseguire il test**

```bash
npm test
```

Atteso: PASS, 1 test. Se fallisce con un errore su JSX, controllare che il plugin `react()` sia in `vitest.config.mts`. Se fallisce con `toBeInTheDocument is not a function`, controllare l'import in `vitest.setup.ts`.

- [ ] **Step 6: Rimuovere il test di fumo e commit**

```bash
rm lib/i18n/__tests__/smoke.test.tsx
git add -A
git commit -m "chore: configura Vitest con jsdom e mock delle primitive Next"
```

---

## Task 3: Creare il progetto Sanity e i dataset

**Files:**
- Create: `sanity.cli.ts`, `.env.example`, `.env.local`

Questa task crea una risorsa permanente sull'account Sanity dell'utente. L'utente l'ha approvata esplicitamente con nome `andrea-gallato-photography` e dataset `production`.

- [ ] **Step 1: Verificare l'autenticazione e i flag disponibili della CLI**

```bash
npx sanity@latest debug --secrets
```

Atteso: mostra l'utente autenticato. Se non lo è, l'utente deve eseguire `npx sanity@latest login` di persona — non automatizzare un login.

```bash
npx sanity@latest init --help
```

Leggere i flag effettivamente disponibili in questa versione della CLI prima di eseguire il comando dello step successivo, invece di assumerli.

- [ ] **Step 2: Creare il progetto**

Con i flag confermati allo step precedente, creare il progetto **senza** scaffolding di uno Studio separato (lo Studio è embedded in questo repository):

```bash
npx sanity@latest init --create-project "andrea-gallato-photography" --dataset production --output-path /tmp/sanity-bootstrap --template clean --typescript
```

Annotare il `projectId` restituito, poi eliminare lo scaffold temporaneo:

```bash
rm -rf /tmp/sanity-bootstrap
```

**Fallback se i flag differiscono:** creare il progetto da <https://www.sanity.io/manage> nel browser e annotare il `projectId`. Non improvvisare flag non documentati.

- [ ] **Step 3: Creare `sanity.cli.ts`**

Sostituire `<PROJECT_ID>` con il valore reale.

```ts
import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '<PROJECT_ID>',
    dataset: 'production',
  },
  typegen: {
    path: [
      './lib/**/*.ts',
      './app/**/*.{ts,tsx}',
      './views/**/*.tsx',
      './components/**/*.tsx',
    ],
    schema: './schema.json',
    generates: './lib/sanity/types.generated.ts',
  },
})
```

I default di TypeGen puntano a `./src/**`, che questo repository non ha: con i default `sanity typegen generate` troverebbe zero query e produrrebbe un file di tipi vuoto, senza errori.

- [ ] **Step 4: Creare i dataset `development` ed `e2e`**

```bash
npx sanity@latest dataset create development
npx sanity@latest dataset create e2e
npx sanity@latest dataset list
```

Atteso: elenca `production`, `development`, `e2e`. Se il piano non consente tre dataset, fermarsi e segnalarlo all'utente: la scelta fra unire `development` ed `e2e` o cambiare piano è sua.

- [ ] **Step 5: Creare `.env.example` (versionato)**

```
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=development
NEXT_PUBLIC_SANITY_API_VERSION=2026-08-07
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SANITY_API_READ_TOKEN=
SANITY_REVALIDATE_SECRET=
SANITY_PREVIEW_SECRET=
```

- [ ] **Step 6: Creare `.env.local` (non versionato)**

Copiare `.env.example` e valorizzare `NEXT_PUBLIC_SANITY_PROJECT_ID` con il projectId reale. `SANITY_API_READ_TOKEN` si crea da <https://www.sanity.io/manage> → API → Tokens, con permesso **Viewer**; serve dalla Fase 2, quindi può restare vuoto ora.

Verificare che `.env.local` non sia tracciato:

```bash
git check-ignore -v .env.local
```

Atteso: una riga che mostra la regola di `.gitignore` che lo esclude.

- [ ] **Step 7: Commit**

```bash
git add sanity.cli.ts .env.example
git commit -m "feat: crea il progetto Sanity e configura CLI e TypeGen"
```

---

## Task 4: Design token e reset

**Files:**
- Create: `styles/tokens.css`, `styles/reset.css`, `styles/typography.css`

- [ ] **Step 1: Creare `styles/tokens.css`**

```css
:root,
[data-theme='dark'],
.surface-dark {
  color-scheme: dark;

  --bg: #0a0a0b;
  --bg-elevated: #131316;
  --fg: #ededee;
  --fg-muted: #9a9a9e;
  --border: #26262a;
  --focus-ring: #7fb2ff;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif;
  --font-serif: ui-serif, Georgia, "Times New Roman", serif;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2.5rem;
  --space-6: 4rem;
  --space-7: 6rem;

  --radius: 2px;
  --focus-offset: 3px;
  --target-min: 44px;
  --content-max: 1600px;

  --duration-fast: 120ms;
  --duration-slow: 320ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}

[data-theme='light'] {
  color-scheme: light;

  --bg: #faf8f5;
  --bg-elevated: #ffffff;
  --fg: #17171a;
  --fg-muted: #5c5c63;
  --border: #dedad3;
  --focus-ring: #1a56c4;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-slow: 0ms;
  }
}
```

Tre punti che il design §8 impone e che sono facili da perdere:

- I token scuri stanno su `:root`, `[data-theme='dark']` **e** `.surface-dark`. Senza `.surface-dark`, la lightbox del piano 1B — montata dentro un documento con `data-theme='light'` — erediterebbe i colori chiari pur dovendo restare scura, producendo testo bianco su bianco.
- `color-scheme` è dichiarato **in CSS, non dallo script**. Se dipendesse dal JavaScript, al primo accesso resterebbe al default chiaro e il browser disegnerebbe scrollbar e controlli nativi in chiaro sopra un fondo quasi nero.
- `--focus-ring` è diverso nei due temi: `#7fb2ff` non raggiunge 3:1 su un fondo chiaro. WCAG 2.4.7 è livello AA.

- [ ] **Step 2: Creare `styles/reset.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

* { margin: 0; }

html {
  scrollbar-gutter: stable;
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img, picture, svg, video { display: block; max-width: 100%; }

button, input, select, textarea { font: inherit; color: inherit; }

button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
```

**È vietato aggiungere `outline: none` a questo file.** È il punto in cui l'indicatore di focus viene tipicamente azzerato per errore, e la specifica di prodotto §13 richiede «focus sempre visibile».

`scrollbar-gutter: stable` elimina il salto di layout all'apertura della lightbox senza calcoli JavaScript (design §9).

- [ ] **Step 3: Creare `styles/typography.css`**

```css
h1, h2, h3 {
  font-family: var(--font-serif);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

h1 { font-size: clamp(1.75rem, 1.2rem + 2vw, 3rem); }
h2 { font-size: clamp(1.35rem, 1.1rem + 1vw, 2rem); }
h3 { font-size: 1.15rem; }

p { max-width: 68ch; }

a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 0.2em; }

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 4: Commit**

```bash
git add styles/
git commit -m "feat: design token, reset e tipografia con focus e target accessibili"
```

---

## Task 5: `locales.ts` e `isLocale`

**Files:**
- Create: `lib/i18n/locales.ts`
- Test: `lib/i18n/__tests__/locales.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/i18n/__tests__/locales.test.ts
import { describe, it, expect } from 'vitest'
import { LOCALES, DEFAULT_LOCALE, isLocale } from '../locales'

describe('locales', () => {
  it('espone italiano e inglese, con italiano come default', () => {
    expect(LOCALES).toEqual(['it', 'en'])
    expect(DEFAULT_LOCALE).toBe('it')
  })

  it('riconosce i locale supportati', () => {
    expect(isLocale('it')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })

  it('rifiuta qualunque altro valore', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('IT')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})
```

`isLocale('IT')` deve essere `false`: i percorsi sono case-sensitive e accettare varianti creerebbe URL duplicati indicizzabili.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run lib/i18n/__tests__/locales.test.ts
```

Atteso: FAIL, `Failed to resolve import "../locales"`.

- [ ] **Step 3: Scrivere l'implementazione minima**

```ts
// lib/i18n/locales.ts
export const LOCALES = ['it', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'it'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/i18n/__tests__/locales.test.ts
```

Atteso: PASS, 3 test.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/locales.ts lib/i18n/__tests__/locales.test.ts
git commit -m "feat: locale supportati e type guard isLocale"
```

---

## Task 6: Dizionario dei percorsi e risoluzione delle rotte

**Files:**
- Create: `lib/i18n/routes.ts`
- Test: `lib/i18n/__tests__/routes.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/i18n/__tests__/routes.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRoute, pathFor, alternatePaths } from '../routes'

describe('resolveRoute', () => {
  it('risolve la homepage con segmenti vuoti', () => {
    expect(resolveRoute('it', [])).toEqual({ key: 'home' })
    expect(resolveRoute('en', [])).toEqual({ key: 'home' })
  })

  it('risolve i segmenti tradotti nella lingua corretta', () => {
    expect(resolveRoute('it', ['fotografie'])).toEqual({ key: 'gallery' })
    expect(resolveRoute('en', ['photographs'])).toEqual({ key: 'gallery' })
    expect(resolveRoute('it', ['progetti'])).toEqual({ key: 'projects' })
    expect(resolveRoute('en', ['projects'])).toEqual({ key: 'projects' })
    expect(resolveRoute('it', ['about'])).toEqual({ key: 'about' })
  })

  it('rifiuta il segmento della lingua sbagliata', () => {
    expect(resolveRoute('it', ['photographs'])).toBeNull()
    expect(resolveRoute('en', ['fotografie'])).toBeNull()
  })

  it('rifiuta il nome canonico interno', () => {
    expect(resolveRoute('it', ['gallery'])).toBeNull()
    expect(resolveRoute('en', ['gallery'])).toBeNull()
  })

  it('risolve una pagina di progetto con lo slug', () => {
    expect(resolveRoute('it', ['progetti', 'nebbia'])).toEqual({ key: 'project', slug: 'nebbia' })
    expect(resolveRoute('en', ['projects', 'nebbia'])).toEqual({ key: 'project', slug: 'nebbia' })
  })

  it('rifiuta percorsi sconosciuti e troppo profondi', () => {
    expect(resolveRoute('it', ['qualunque-cosa'])).toBeNull()
    expect(resolveRoute('it', ['fotografie', 'extra'])).toBeNull()
    expect(resolveRoute('it', ['progetti', 'nebbia', 'extra'])).toBeNull()
  })

  it('rifiuta uno slug di progetto vuoto', () => {
    expect(resolveRoute('it', ['progetti', ''])).toBeNull()
  })
})

describe('pathFor', () => {
  it('costruisce il percorso pubblico localizzato', () => {
    expect(pathFor('it', { key: 'home' })).toBe('/it')
    expect(pathFor('en', { key: 'home' })).toBe('/en')
    expect(pathFor('it', { key: 'gallery' })).toBe('/it/fotografie')
    expect(pathFor('en', { key: 'gallery' })).toBe('/en/photographs')
    expect(pathFor('it', { key: 'project', slug: 'nebbia' })).toBe('/it/progetti/nebbia')
    expect(pathFor('en', { key: 'project', slug: 'nebbia' })).toBe('/en/projects/nebbia')
  })
})

describe('alternatePaths', () => {
  it('produce il percorso equivalente in entrambe le lingue', () => {
    expect(alternatePaths({ key: 'gallery' })).toEqual({
      it: '/it/fotografie',
      en: '/en/photographs',
    })
  })

  it('mantiene lo stesso slug di progetto nelle due lingue', () => {
    expect(alternatePaths({ key: 'project', slug: 'nebbia' })).toEqual({
      it: '/it/progetti/nebbia',
      en: '/en/projects/nebbia',
    })
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run lib/i18n/__tests__/routes.test.ts
```

Atteso: FAIL, `Failed to resolve import "../routes"`.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/i18n/routes.ts
import { LOCALES, type Locale } from './locales'

export const ROUTES = {
  home: { it: [], en: [] },
  gallery: { it: ['fotografie'], en: ['photographs'] },
  projects: { it: ['progetti'], en: ['projects'] },
  about: { it: ['about'], en: ['about'] },
} as const satisfies Record<string, Record<Locale, readonly string[]>>

export type StaticRouteKey = keyof typeof ROUTES

export type Resolved =
  | { key: StaticRouteKey }
  | { key: 'project'; slug: string }

export function resolveRoute(locale: Locale, segments: readonly string[] = []): Resolved | null {
  if (segments.length === 0) return { key: 'home' }

  if (segments.length === 1) {
    for (const key of Object.keys(ROUTES) as StaticRouteKey[]) {
      const expected = ROUTES[key][locale]
      if (expected.length === 1 && expected[0] === segments[0]) return { key }
    }
    return null
  }

  if (segments.length === 2 && segments[0] === ROUTES.projects[locale][0]) {
    const slug = segments[1]
    return slug ? { key: 'project', slug } : null
  }

  return null
}

export function pathFor(locale: Locale, resolved: Resolved): string {
  const segments =
    resolved.key === 'project'
      ? [...ROUTES.projects[locale], resolved.slug]
      : [...ROUTES[resolved.key][locale]]

  return ['', locale, ...segments].join('/')
}

export function alternatePaths(resolved: Resolved): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, pathFor(locale, resolved)]),
  ) as Record<Locale, string>
}
```

`ROUTES.home` ha segmenti vuoti, quindi il ciclo su `segments.length === 1` non lo può mai far corrispondere: la guardia `expected.length === 1` lo esclude esplicitamente.

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/i18n/__tests__/routes.test.ts
```

Atteso: PASS, 10 test.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/routes.ts lib/i18n/__tests__/routes.test.ts
git commit -m "feat: dizionario dei percorsi localizzati con risoluzione e alternate"
```

---

## Task 7: `pickLocalized` con la lingua vinta

**Files:**
- Create: `lib/i18n/localize.ts`
- Test: `lib/i18n/__tests__/localize.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/i18n/__tests__/localize.test.ts
import { describe, it, expect } from 'vitest'
import { pickLocalized } from '../localize'

describe('pickLocalized', () => {
  it('usa l inglese sulla pagina inglese quando è valorizzato', () => {
    expect(pickLocalized({ it: 'Nebbia', en: 'Fog' }, 'en')).toEqual({ value: 'Fog', lang: 'en' })
  })

  it('usa l italiano sulla pagina italiana', () => {
    expect(pickLocalized({ it: 'Nebbia', en: 'Fog' }, 'it')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('ricade sull italiano quando l inglese manca, dichiarando la lingua', () => {
    expect(pickLocalized({ it: 'Nebbia' }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
    expect(pickLocalized({ it: 'Nebbia', en: null }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('tratta una stringa inglese di soli spazi come non valorizzata', () => {
    expect(pickLocalized({ it: 'Nebbia', en: '   ' }, 'en')).toEqual({ value: 'Nebbia', lang: 'it' })
  })

  it('ricade sull inglese se l italiano manca sulla pagina italiana', () => {
    expect(pickLocalized({ en: 'Fog' }, 'it')).toEqual({ value: 'Fog', lang: 'en' })
  })

  it('restituisce stringa vuota quando entrambi mancano', () => {
    expect(pickLocalized({}, 'en')).toEqual({ value: '', lang: 'en' })
    expect(pickLocalized(null, 'it')).toEqual({ value: '', lang: 'it' })
    expect(pickLocalized(undefined, 'it')).toEqual({ value: '', lang: 'it' })
  })

  it('rimuove gli spazi ai bordi del valore restituito', () => {
    expect(pickLocalized({ it: '  Nebbia  ' }, 'it')).toEqual({ value: 'Nebbia', lang: 'it' })
  })
})
```

Il ritorno della lingua non è un dettaglio: un testo italiano dentro una pagina `lang="en"` non marcato viola WCAG 3.1.2 (livello AA), e poiché tutti i campi inglesi sono opzionali per specifica §5.1 e §5.2 è il caso normale.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run lib/i18n/__tests__/localize.test.ts
```

Atteso: FAIL, `Failed to resolve import "../localize"`.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/i18n/localize.ts
import { type Locale } from './locales'

export type LocalizedField = {
  it?: string | null
  en?: string | null
}

export type Picked = {
  value: string
  lang: Locale
}

export function pickLocalized(
  field: LocalizedField | null | undefined,
  locale: Locale,
): Picked {
  const it = field?.it?.trim() ?? ''
  const en = field?.en?.trim() ?? ''

  if (locale === 'en') {
    if (en) return { value: en, lang: 'en' }
    if (it) return { value: it, lang: 'it' }
    return { value: '', lang: 'en' }
  }

  if (it) return { value: it, lang: 'it' }
  if (en) return { value: en, lang: 'en' }
  return { value: '', lang: 'it' }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/i18n/__tests__/localize.test.ts
```

Atteso: PASS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/localize.ts lib/i18n/__tests__/localize.test.ts
git commit -m "feat: pickLocalized restituisce valore e lingua per marcare il fallback"
```

---

## Task 8: Dizionari delle etichette

**Files:**
- Create: `lib/i18n/dictionaries/it.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/index.ts`
- Test: `lib/i18n/__tests__/dictionaries.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/i18n/__tests__/dictionaries.test.ts
import { describe, it, expect } from 'vitest'
import { getDictionary } from '../dictionaries'
import { it as itDict } from '../dictionaries/it'
import { en as enDict } from '../dictionaries/en'

describe('dizionari', () => {
  it('restituisce il dizionario della lingua richiesta', () => {
    expect(getDictionary('it')).toBe(itDict)
    expect(getDictionary('en')).toBe(enDict)
  })

  it('ha esattamente le stesse chiavi nelle due lingue', () => {
    expect(Object.keys(enDict).sort()).toEqual(Object.keys(itDict).sort())
  })

  it('non ha valori vuoti', () => {
    for (const [key, value] of Object.entries(itDict)) {
      expect(value, `it.${key}`).not.toBe('')
    }
    for (const [key, value] of Object.entries(enDict)) {
      expect(value, `en.${key}`).not.toBe('')
    }
  })

  it('scrive il nome di ciascuna lingua nella lingua stessa', () => {
    expect(itDict.localeNameIt).toBe('Italiano')
    expect(itDict.localeNameEn).toBe('English')
    expect(enDict.localeNameIt).toBe('Italiano')
    expect(enDict.localeNameEn).toBe('English')
  })
})
```

L'ultimo test fissa un requisito di accessibilità: il link verso l'altra lingua porta l'etichetta scritta **nella lingua di destinazione**, altrimenti «English» dentro una pagina italiana viene pronunciato con fonetica italiana (WCAG 3.1.2).

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run lib/i18n/__tests__/dictionaries.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere i dizionari**

```ts
// lib/i18n/dictionaries/it.ts
export const it = {
  skipToContent: 'Vai al contenuto',
  navGallery: 'Fotografie',
  navProjects: 'Progetti',
  navAbout: 'About',
  openMenu: 'Apri il menu',
  closeMenu: 'Chiudi il menu',
  themeToggle: 'Tema chiaro',
  localeGroup: 'Lingua',
  localeNameIt: 'Italiano',
  localeNameEn: 'English',
  loadMore: 'Carica altre',
  loading: 'Caricamento…',
  retry: 'Riprova',
  errorGeneric: 'Qualcosa non ha funzionato.',
  emptyGallery: 'Nessuna fotografia pubblicata al momento.',
  notFoundTitle: 'Pagina non trovata',
  notFoundBody: 'La pagina che cerchi non esiste o è stata spostata.',
  backHome: 'Torna alla home',
  lightboxLabel: 'Visualizzatore fotografie',
  lightboxClose: 'Chiudi',
  lightboxPrev: 'Fotografia precedente',
  lightboxNext: 'Fotografia successiva',
} as const

export type Dictionary = typeof it
```

```ts
// lib/i18n/dictionaries/en.ts
import type { Dictionary } from './it'

export const en: Dictionary = {
  skipToContent: 'Skip to content',
  navGallery: 'Photographs',
  navProjects: 'Projects',
  navAbout: 'About',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  themeToggle: 'Light theme',
  localeGroup: 'Language',
  localeNameIt: 'Italiano',
  localeNameEn: 'English',
  loadMore: 'Load more',
  loading: 'Loading…',
  retry: 'Try again',
  errorGeneric: 'Something went wrong.',
  emptyGallery: 'No photographs published yet.',
  notFoundTitle: 'Page not found',
  notFoundBody: 'The page you are looking for does not exist or has moved.',
  backHome: 'Back to home',
  lightboxLabel: 'Photograph viewer',
  lightboxClose: 'Close',
  lightboxPrev: 'Previous photograph',
  lightboxNext: 'Next photograph',
}
```

Tipizzare `en` come `Dictionary` fa fallire la compilazione se una chiave manca o è di troppo: il test sulle chiavi identiche diventa una rete di sicurezza, non l'unico controllo.

```ts
// lib/i18n/dictionaries/index.ts
import { type Locale } from '../locales'
import { it, type Dictionary } from './it'
import { en } from './en'

const DICTIONARIES: Record<Locale, Dictionary> = { it, en }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

export type { Dictionary }
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/i18n/__tests__/dictionaries.test.ts
```

Atteso: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/dictionaries lib/i18n/__tests__/dictionaries.test.ts
git commit -m "feat: dizionari IT/EN con chiavi allineate a compile time"
```

---

## Task 9: Script anti-flash del tema

**Files:**
- Create: `lib/theme/script.ts`
- Test: `lib/theme/__tests__/script.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/theme/__tests__/script.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { THEME_STORAGE_KEY, THEME_SCRIPT } from '../script'

function runScript() {
  // eslint-disable-next-line no-new-func
  new Function(THEME_SCRIPT)()
}

describe('script anti-flash', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applica il tema chiaro memorizzato', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applica il tema scuro memorizzato', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('non tocca l attributo quando non c è nulla di memorizzato', () => {
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('ignora un valore memorizzato non valido', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'fucsia')
    runScript()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('non lancia se localStorage non è accessibile', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('bloccato') },
    })
    expect(() => runScript()).not.toThrow()
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})
```

Il terzo e il quarto test fissano il comportamento di default: se lo script non scrive nulla, resta il `data-theme="dark"` reso in JSX dal layout. Il quinto copre la resilienza richiesta dal design §13 («se la preferenza tema non è leggibile, viene usato il tema scuro»): in navigazione privata o con i cookie bloccati, l'accesso a `localStorage` può lanciare, e uno script che lancia nel `<head>` bloccherebbe il rendering.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run lib/theme/__tests__/script.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/theme/script.ts
export const THEME_STORAGE_KEY = 'ag-theme'

export type Theme = 'light' | 'dark'

export const DEFAULT_THEME: Theme = 'dark'

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/theme/__tests__/script.test.ts
```

Atteso: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
git add lib/theme lib/theme/__tests__
git commit -m "feat: script anti-flash del tema, resiliente a localStorage non accessibile"
```

---

## Task 10: Root layout con lingua e tema

**Files:**
- Create: `app/[locale]/layout.tsx`, `components/layout/SkipLink.tsx`, `components/layout/SkipLink.module.css`

- [ ] **Step 1: Creare `SkipLink`**

```tsx
// components/layout/SkipLink.tsx
import styles from './SkipLink.module.css'

export function SkipLink({ label }: { label: string }) {
  return (
    <a href="#main" className={styles.skipLink}>
      {label}
    </a>
  )
}
```

```css
/* components/layout/SkipLink.module.css */
.skipLink {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  z-index: 100;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transform: translateY(-200%);
}

.skipLink:focus-visible {
  transform: translateY(0);
}
```

WCAG 2.4.1 Bypass Blocks è livello **A**: con header ripetuto su ogni pagina e una galleria di 24 elementi focalizzabili, senza skip link un utente da tastiera non ha modo di saltare la navigazione. Il link è nascosto con `transform`, non con `display: none`, perché deve restare focalizzabile.

- [ ] **Step 2: Creare il root layout**

```tsx
// app/[locale]/layout.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { THEME_SCRIPT, DEFAULT_THEME } from '@/lib/theme/script'
import { SkipLink } from '@/components/layout/SkipLink'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/typography.css'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)

  return (
    <html lang={locale} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body>
        <SkipLink label={dict.skipToContent} />
        <Header locale={locale} />
        <main id="main">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  )
}
```

Tre punti obbligatori del design §8:

- **`suppressHydrationWarning` su `<html>`.** Lo script modifica il DOM prima che React idrati. Senza questo attributo React tratta la differenza come hydration error e ricostruisce lato client dal boundary più vicino, producendo esattamente il flash che lo script doveva evitare.
- **`data-theme` è reso in JSX con il default scuro.** Serve perché in Strict Mode React azzera gli attributi di `<html>` non presenti nel JSX a ogni remount.
- **Questo è il root layout: non esiste `app/layout.tsx`.** Un root layout senza segmento dinamico sopra di sé non riceve `params` e `<html lang>` resterebbe fissa su `it` anche in inglese, violando WCAG 3.1.1 (livello A).

- [ ] **Step 3: Verificare che non esista `app/layout.tsx`**

```bash
test ! -f app/layout.tsx && echo "corretto: nessun root layout non localizzato"
```

Atteso: stampa il messaggio. Se `create-next-app` o un editor ne ha creato uno, eliminarlo.

- [ ] **Step 4: Commit**

```bash
git add app/\[locale\]/layout.tsx components/layout/SkipLink.tsx components/layout/SkipLink.module.css
git commit -m "feat: root layout localizzato con skip link e anti-flash del tema"
```

---

## Task 11: `ThemeToggle`

**Files:**
- Create: `components/controls/ThemeToggle.tsx`, `components/controls/ThemeToggle.module.css`
- Test: `components/controls/__tests__/ThemeToggle.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/controls/__tests__/ThemeToggle.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '../ThemeToggle'
import { THEME_STORAGE_KEY } from '@/lib/theme/script'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  it('ha un nome accessibile statico che non cambia con lo stato', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    const button = screen.getByRole('button', { name: 'Tema chiaro' })

    await userEvent.click(button)

    expect(screen.getByRole('button', { name: 'Tema chiaro' })).toBeInTheDocument()
  })

  it('parte non premuto sul tema scuro', () => {
    render(<ThemeToggle label="Tema chiaro" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('passa al tema chiaro e lo comunica con aria-pressed', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('memorizza la preferenza', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('torna al tema scuro al secondo clic', async () => {
    render(<ThemeToggle label="Tema chiaro" />)
    const button = screen.getByRole('button')

    await userEvent.click(button)
    await userEvent.click(button)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('non lancia se localStorage non è scrivibile', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('bloccato') },
    })

    render(<ThemeToggle label="Tema chiaro" />)
    await userEvent.click(screen.getByRole('button'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})
```

Il primo test è il più importante e fissa il requisito del design §8: l'etichetta è **statica**. Un'etichetta imperativa che cambia con lo stato («Passa al tema chiaro») combinata con `aria-pressed` produce l'annuncio contraddittorio «Passa al tema chiaro, pulsante di attivazione, premuto».

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run components/controls/__tests__/ThemeToggle.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```tsx
// components/controls/ThemeToggle.tsx
'use client'

import { useLayoutEffect, useState } from 'react'
import { THEME_STORAGE_KEY, DEFAULT_THEME, type Theme } from '@/lib/theme/script'
import styles from './ThemeToggle.module.css'

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage non accessibile: resta il default
  }
  return DEFAULT_THEME
}

export function ThemeToggle({ label }: { label: string }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useLayoutEffect(() => {
    const current = readStoredTheme()
    setTheme(current)
    document.documentElement.setAttribute('data-theme', current)
  }, [])

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // preferenza non memorizzabile: il tema resta applicato per questa sessione
    }
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={theme === 'light'}
      onClick={toggle}
    >
      {label}
    </button>
  )
}
```

`useLayoutEffect` riapplica l'attributo dopo il montaggio: in Strict Mode React rimonta i componenti e azzera gli attributi di `<html>` non presenti nel JSX (design §8). In produzione è di fatto un no-op perché lo script inline ha già impostato il valore corretto.

- [ ] **Step 4: Creare il CSS con l'area di hit minima**

```css
/* components/controls/ThemeToggle.module.css */
.toggle {
  position: relative;
  padding: var(--space-2);
  color: var(--fg-muted);
  border-radius: var(--radius);
  transition: color var(--duration-fast) var(--ease);
}

.toggle:hover { color: var(--fg); }

.toggle::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  min-width: var(--target-min);
  min-height: var(--target-min);
  width: 100%;
  height: 100%;
}
```

Lo pseudo-elemento garantisce un'area di hit di almeno 44px anche quando il controllo visibile è più piccolo. WCAG 2.5.8 (livello AA) richiede 24px come minimo assoluto, e i controlli a rischio sono proprio quelli che la specifica §7 vuole «discreti».

- [ ] **Step 5: Eseguire il test e verificare che passi**

```bash
npx vitest run components/controls/__tests__/ThemeToggle.test.tsx
```

Atteso: PASS, 6 test.

- [ ] **Step 6: Commit**

```bash
git add components/controls/ThemeToggle.tsx components/controls/ThemeToggle.module.css components/controls/__tests__/ThemeToggle.test.tsx
git commit -m "feat: ThemeToggle con etichetta statica, aria-pressed e area di hit 44px"
```

---

## Task 12: `LocaleSwitcher`

**Files:**
- Create: `components/controls/LocaleSwitcher.tsx`, `components/controls/LocaleSwitcher.module.css`
- Test: `components/controls/__tests__/LocaleSwitcher.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/controls/__tests__/LocaleSwitcher.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LocaleSwitcher } from '../LocaleSwitcher'

const paths = { it: '/it/fotografie', en: '/en/photographs' }

describe('LocaleSwitcher', () => {
  it('rende due link, non un select', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('marca la lingua attiva con aria-current', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('link', { name: 'Italiano' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'English' })).not.toHaveAttribute('aria-current')
  })

  it('marca il link verso l altra lingua con lang e hreflang', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    const other = screen.getByRole('link', { name: 'English' })
    expect(other).toHaveAttribute('lang', 'en')
    expect(other).toHaveAttribute('hreflang', 'en')
  })

  it('punta al percorso equivalente nell altra lingua', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/photographs')
  })

  it('espone un nome accessibile al gruppo', () => {
    render(<LocaleSwitcher current="it" paths={paths} groupLabel="Lingua" names={{ it: 'Italiano', en: 'English' }} />)

    expect(screen.getByRole('navigation', { name: 'Lingua' })).toBeInTheDocument()
  })
})
```

Il terzo test è un requisito WCAG 3.1.2: senza `lang`, «English» dentro una pagina italiana viene pronunciato con fonetica italiana.

Nota sul design: il componente riceve i percorsi **come prop calcolate dal server**, non li deriva da `usePathname`. Non c'è alcun rewrite in questo progetto, ma passare le prop mantiene i link corretti anche nell'HTML servito prima dell'idratazione, quindi funzionanti per i crawler e senza JavaScript.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run components/controls/__tests__/LocaleSwitcher.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```tsx
// components/controls/LocaleSwitcher.tsx
import Link from 'next/link'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import styles from './LocaleSwitcher.module.css'

export function LocaleSwitcher({
  current,
  paths,
  groupLabel,
  names,
}: {
  current: Locale
  paths: Record<Locale, string>
  groupLabel: string
  names: Record<Locale, string>
}) {
  return (
    <nav aria-label={groupLabel} className={styles.switcher}>
      {LOCALES.map((locale) => {
        const isCurrent = locale === current
        return (
          <Link
            key={locale}
            href={paths[locale]}
            className={styles.link}
            data-current={isCurrent || undefined}
            {...(isCurrent
              ? { 'aria-current': 'true' as const }
              : { lang: locale, hrefLang: locale })}
          >
            {names[locale]}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Creare il CSS**

```css
/* components/controls/LocaleSwitcher.module.css */
.switcher {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.link {
  position: relative;
  padding: var(--space-2);
  color: var(--fg-muted);
  text-decoration: none;
  font-size: 0.875rem;
}

.link[data-current] {
  color: var(--fg);
  text-decoration: underline;
}

.link::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  min-width: var(--target-min);
  min-height: var(--target-min);
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

```bash
npx vitest run components/controls/__tests__/LocaleSwitcher.test.tsx
```

Atteso: PASS, 5 test.

- [ ] **Step 6: Commit**

```bash
git add components/controls/LocaleSwitcher.tsx components/controls/LocaleSwitcher.module.css components/controls/__tests__/LocaleSwitcher.test.tsx
git commit -m "feat: LocaleSwitcher come coppia di link con lang, hreflang e aria-current"
```

---

## Task 13: `Header` e `Footer`

**Files:**
- Create: `components/layout/Header.tsx`, `components/layout/Header.module.css`, `components/layout/Footer.tsx`, `components/layout/Footer.module.css`
- Test: `components/layout/__tests__/Header.test.tsx`

In Fase 1 l'header linka soltanto Fotografie: Progetti e About arrivano in Fase 2 con le rispettive pagine, così la navigazione non punta mai a una 404.

Il menu mobile con `aria-expanded` e trappola del focus è rimandato al piano 1B, insieme alla galleria: in 1A c'è una sola voce di menu e un menu a scomparsa non è giustificato.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/layout/__tests__/Header.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'

describe('Header', () => {
  it('espone un landmark di navigazione', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('mostra il nome del fotografo come link alla home localizzata', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Andrea Gallato' })).toHaveAttribute('href', '/it')
  })

  it('linka la galleria con il segmento della lingua corrente', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Fotografie' })).toHaveAttribute('href', '/it/fotografie')
  })

  it('usa i segmenti inglesi in inglese', () => {
    render(<Header locale="en" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Photographs' })).toHaveAttribute('href', '/en/photographs')
    expect(screen.getByRole('link', { name: 'Andrea Gallato' })).toHaveAttribute('href', '/en')
  })

  it('contiene il selettore lingua e l interruttore tema', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('navigation', { name: 'Lingua' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tema chiaro' })).toBeInTheDocument()
  })

  it('non linka Progetti e About in questa fase', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.queryByRole('link', { name: 'Progetti' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run components/layout/__tests__/Header.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere `Header`**

```tsx
// components/layout/Header.tsx
import Link from 'next/link'
import { type Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor, alternatePaths } from '@/lib/i18n/routes'
import { ThemeToggle } from '@/components/controls/ThemeToggle'
import { LocaleSwitcher } from '@/components/controls/LocaleSwitcher'
import styles from './Header.module.css'

export function Header({ locale, siteName }: { locale: Locale; siteName: string }) {
  const dict = getDictionary(locale)

  return (
    <header className={styles.header}>
      <Link href={pathFor(locale, { key: 'home' })} className={styles.name}>
        {siteName}
      </Link>

      <nav aria-label={dict.navGallery} className={styles.nav}>
        <Link href={pathFor(locale, { key: 'gallery' })} className={styles.link}>
          {dict.navGallery}
        </Link>
      </nav>

      <div className={styles.controls}>
        <LocaleSwitcher
          current={locale}
          paths={alternatePaths({ key: 'home' })}
          groupLabel={dict.localeGroup}
          names={{ it: dict.localeNameIt, en: dict.localeNameEn }}
        />
        <ThemeToggle label={dict.themeToggle} />
      </div>
    </header>
  )
}
```

**Nota per il piano 1B:** qui `alternatePaths` è calcolato sulla home. Quando le pagine reali esisteranno, l'header dovrà ricevere la `Resolved` della pagina corrente come prop dal layout, così il selettore lingua porta alla pagina equivalente e non alla home (specifica di prodotto §6). In 1A esiste solo la home, quindi il comportamento coincide; il test corrispondente va aggiunto in 1B.

- [ ] **Step 4: Scrivere il CSS dell'header**

```css
/* components/layout/Header.module.css */
.header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  max-width: var(--content-max);
  margin: 0 auto;
  width: 100%;
}

.name {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  text-decoration: none;
  margin-right: auto;
}

.nav { display: flex; gap: var(--space-3); }

.link {
  color: var(--fg-muted);
  text-decoration: none;
  font-size: 0.875rem;
  padding: var(--space-2);
}

.link:hover { color: var(--fg); }

.controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
```

- [ ] **Step 5: Scrivere `Footer`**

```tsx
// components/layout/Footer.tsx
import { type Locale } from '@/lib/i18n/locales'
import styles from './Footer.module.css'

export function Footer({
  locale,
  siteName,
  email,
}: {
  locale: Locale
  siteName: string
  email?: string
}) {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <p className={styles.line}>
        © {year} {siteName}
      </p>
      {email ? (
        <a href={`mailto:${email}`} className={styles.link}>
          {email}
        </a>
      ) : null}
    </footer>
  )
}
```

```css
/* components/layout/Footer.module.css */
.footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-6) var(--space-4) var(--space-4);
  max-width: var(--content-max);
  margin: 0 auto;
  width: 100%;
  color: var(--fg-muted);
  font-size: 0.875rem;
}

.line { max-width: none; }

.link { color: inherit; }
```

Il footer non contiene moduli né newsletter (specifica di prodotto §8.1). I collegamenti social arrivano in Fase 2 con `aboutPage` e `siteSettings`.

- [ ] **Step 6: Aggiornare il layout per passare `siteName`**

In `app/[locale]/layout.tsx`, sostituire le due righe di `Header` e `Footer` con:

```tsx
        <Header locale={locale} siteName="Andrea Gallato" />
        <main id="main">{children}</main>
        <Footer locale={locale} siteName="Andrea Gallato" />
```

Il nome è temporaneamente letterale: la Task 18 lo sostituisce con il valore letto da `siteSettings`, come richiede il design (`siteSettings` è la fonte di verità, il nome non va scritto a mano nel codice).

- [ ] **Step 7: Eseguire i test e verificare che passino**

```bash
npx vitest run components/layout
```

Atteso: PASS, 6 test.

- [ ] **Step 8: Commit**

```bash
git add components/layout app/\[locale\]/layout.tsx
git commit -m "feat: header e footer con landmark, controlli e navigazione localizzata"
```

---

## Task 14: Catch-all route, `HomeView` e 404 localizzata

**Files:**
- Create: `app/[locale]/[[...segments]]/page.tsx`, `app/[locale]/not-found.tsx`, `app/[locale]/error.tsx`, `views/HomeView.tsx`
- Test: `app/[locale]/__tests__/routing.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// app/[locale]/__tests__/routing.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRoute } from '@/lib/i18n/routes'
import { isLocale } from '@/lib/i18n/locales'

// Riproduce la logica di guardia della catch-all come funzione pura,
// così il contratto è testabile senza rendere un Server Component async.
function routeOrNull(locale: string, segments: string[] = []) {
  if (!isLocale(locale)) return null
  return resolveRoute(locale, segments)
}

describe('guardia della catch-all', () => {
  it('accetta le home localizzate', () => {
    expect(routeOrNull('it', [])).toEqual({ key: 'home' })
    expect(routeOrNull('en', [])).toEqual({ key: 'home' })
  })

  it('rifiuta un locale non supportato', () => {
    expect(routeOrNull('fr', [])).toBeNull()
    expect(routeOrNull('fr', ['fotografie'])).toBeNull()
    expect(routeOrNull('IT', [])).toBeNull()
  })

  it('rifiuta il nome canonico interno', () => {
    expect(routeOrNull('it', ['gallery'])).toBeNull()
  })

  it('rifiuta il segmento della lingua sbagliata', () => {
    expect(routeOrNull('it', ['photographs'])).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che passi già**

```bash
npx vitest run app/\[locale\]/__tests__/routing.test.ts
```

Atteso: PASS, 4 test. Questo test non guida nuovo codice: fissa il contratto che la catch-all deve rispettare, e fallirebbe se qualcuno allentasse `isLocale` o `resolveRoute` in futuro. Serve da rete di sicurezza per la 404, che altrimenti sarebbe verificabile solo negli e2e.

- [ ] **Step 3: Scrivere `HomeView`**

```tsx
// views/HomeView.tsx
import { type Locale } from '@/lib/i18n/locales'
import styles from './HomeView.module.css'

export function HomeView({ locale }: { locale: Locale }) {
  return (
    <div className={styles.home}>
      <h1 className={styles.title}>Andrea Gallato</h1>
      <p className={styles.intro} lang={locale}>
        {locale === 'it'
          ? 'Fotografia di paesaggio, street e ritratto.'
          : 'Landscape, street and portrait photography.'}
      </p>
    </div>
  )
}
```

Questi testi sono **temporanei** e vengono sostituiti in Task 18 dai campi di `homePage` letti da Sanity. La fotografia protagonista arriva nel piano 1B.

```css
/* views/HomeView.module.css */
.home {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-7) var(--space-4);
}

.title { margin-bottom: var(--space-3); }

.intro { color: var(--fg-muted); font-size: 1.1rem; }
```

- [ ] **Step 4: Scrivere la catch-all**

```tsx
// app/[locale]/[[...segments]]/page.tsx
import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { resolveRoute } from '@/lib/i18n/routes'
import { HomeView } from '@/views/HomeView'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, segments: [] as string[] }))
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>
}) {
  const { locale, segments } = await params
  if (!isLocale(locale)) notFound()

  const route = resolveRoute(locale, segments ?? [])
  if (!route) notFound()

  switch (route.key) {
    case 'home':
      return <HomeView locale={locale} />
    default:
      // gallery, projects, project e about arrivano nei piani 1B e Fase 2.
      notFound()
  }
}
```

`dynamicParams` resta al default `true`, così i progetti pubblicati dopo il build vengono generati su richiesta invece di dare 404 fino al deploy successivo. La validazione dentro la catch-all garantisce comunque il 404 sui percorsi inesistenti.

- [ ] **Step 5: Scrivere la 404 localizzata**

```tsx
// app/[locale]/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-7) var(--space-4)' }}>
      <h1>404</h1>
      <p style={{ marginTop: 'var(--space-3)', color: 'var(--fg-muted)' }}>
        Pagina non trovata — Page not found
      </p>
      <p style={{ marginTop: 'var(--space-4)' }}>
        <Link href="/it">Torna alla home</Link>
        {' · '}
        <Link href="/en">Back to home</Link>
      </p>
    </div>
  )
}
```

**Limite noto, da registrare:** `not-found.tsx` non riceve `params`, quindi non conosce il locale. Il testo è quindi bilingue su una riga sola. In Fase 2, se serve una 404 pienamente monolingue, la si ottiene rendendo la pagina non-trovata dentro la catch-all invece di chiamare `notFound()` — al costo di dover impostare esplicitamente lo status 404. La decisione va presa in Fase 2, non improvvisata qui.

- [ ] **Step 6: Scrivere l'error boundary**

```tsx
// app/[locale]/error.tsx
'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-7) var(--space-4)' }}>
      <h1>Errore — Error</h1>
      <p style={{ marginTop: 'var(--space-3)', color: 'var(--fg-muted)' }}>
        Qualcosa non ha funzionato — Something went wrong.
      </p>
      <button type="button" onClick={reset} style={{ marginTop: 'var(--space-4)', textDecoration: 'underline' }}>
        Riprova — Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Avviare il server e verificare a mano**

```bash
npm run dev
```

Verificare in un browser:

| URL | Atteso |
|---|---|
| `http://localhost:3000/` | redirect a `/it` |
| `http://localhost:3000/it` | homepage, `<html lang="it">` |
| `http://localhost:3000/en` | homepage, `<html lang="en">` |
| `http://localhost:3000/it/gallery` | 404 |
| `http://localhost:3000/it/photographs` | 404 |
| `http://localhost:3000/fr` | 404 |

- [ ] **Step 8: Commit**

```bash
git add app views
git commit -m "feat: catch-all guidata dal dizionario con 404 localizzata ed error boundary"
```

---

## Task 15: Schemi Sanity

**Files:**
- Create: `sanity/schemas/photo.ts`, `project.ts`, `homePage.ts`, `aboutPage.ts`, `siteSettings.ts`, `index.ts`

- [ ] **Step 1: Creare lo schema `photo`**

```ts
// sanity/schemas/photo.ts
import { defineField, defineType } from 'sanity'
import { orderRankField } from '@sanity/orderable-document-list'

export const photo = defineType({
  name: 'photo',
  title: 'Fotografia',
  type: 'document',
  fields: [
    defineField({
      name: 'image',
      title: 'Immagine',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'altIt',
      title: 'Testo alternativo (italiano)',
      type: 'string',
      description: 'Descrive la fotografia a chi non può vederla. Obbligatorio.',
      validation: (rule) => rule.required().min(3),
    }),
    defineField({
      name: 'altEn',
      title: 'Testo alternativo (inglese)',
      type: 'string',
      description: 'Se vuoto viene usato quello italiano.',
    }),
    defineField({ name: 'titleIt', title: 'Titolo (italiano)', type: 'string' }),
    defineField({ name: 'titleEn', title: 'Titolo (inglese)', type: 'string' }),
    defineField({ name: 'placeIt', title: 'Luogo (italiano)', type: 'string' }),
    defineField({ name: 'placeEn', title: 'Luogo (inglese)', type: 'string' }),
    defineField({
      name: 'year',
      title: 'Anno',
      type: 'number',
      validation: (rule) => rule.integer().min(1950).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'showInGallery',
      title: 'Mostra nella galleria',
      type: 'boolean',
      initialValue: false,
      description: 'Disattivato per impostazione iniziale. Le fotografie restano comunque usabili nei progetti.',
    }),
    orderRankField({ type: 'photo' }),
  ],
  preview: {
    select: { title: 'titleIt', subtitle: 'altIt', media: 'image' },
    prepare: ({ title, subtitle, media }) => ({
      title: title || subtitle || 'Senza titolo',
      subtitle: title ? subtitle : undefined,
      media,
    }),
  },
})
```

L'intervallo dell'anno è 1950–anno corrente, come fissato dal design §11.2: senza un intervallo dichiarato due implementatori sceglierebbero limiti diversi.

- [ ] **Step 2: Creare lo schema `project`**

```ts
// sanity/schemas/project.ts
import { defineField, defineType } from 'sanity'

export const project = defineType({
  name: 'project',
  title: 'Progetto',
  type: 'document',
  fields: [
    defineField({
      name: 'titleIt',
      title: 'Titolo (italiano)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'titleEn', title: 'Titolo (inglese)', type: 'string' }),
    defineField({
      name: 'descriptionIt',
      title: 'Descrizione (italiano)',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'descriptionEn', title: 'Descrizione (inglese)', type: 'text', rows: 4 }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'titleIt', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Anno',
      type: 'number',
      validation: (rule) => rule.integer().min(1950).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'cover',
      title: 'Fotografia di copertina',
      type: 'reference',
      to: [{ type: 'photo' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'photos',
      title: 'Fotografie',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'photo' }] }],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'featured',
      title: 'In evidenza',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: 'titleIt', subtitle: 'year', media: 'cover.image' },
  },
})
```

I riferimenti sono **forti** (nessun `weak: true`). Sanity impedisce quindi nativamente sia di eliminare sia di pubblicare un progetto che referenzia fotografie ancora in bozza. Conseguenza da comunicare al fotografo (design §11.2): una fotografia usata in un progetto pubblicato non è né eliminabile né spubblicabile finché il riferimento esiste — prima va rimossa dal progetto.

- [ ] **Step 3: Creare i tre singleton**

```ts
// sanity/schemas/homePage.ts
import { defineField, defineType } from 'sanity'

export const homePage = defineType({
  name: 'homePage',
  title: 'Homepage',
  type: 'document',
  fields: [
    defineField({
      name: 'heroPhoto',
      title: 'Fotografia protagonista',
      type: 'reference',
      to: [{ type: 'photo' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'introIt', title: 'Introduzione (italiano)', type: 'text', rows: 3 }),
    defineField({ name: 'introEn', title: 'Introduzione (inglese)', type: 'text', rows: 3 }),
    defineField({
      name: 'selectedPhotos',
      title: 'Fotografie selezionate',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'photo' }] }],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'selectedProjects',
      title: 'Progetti selezionati',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'project' }] }],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: { prepare: () => ({ title: 'Homepage' }) },
})
```

```ts
// sanity/schemas/aboutPage.ts
import { defineField, defineType } from 'sanity'

export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'About',
  type: 'document',
  fields: [
    defineField({
      name: 'portrait',
      title: 'Ritratto',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bioIt',
      title: 'Biografia (italiano)',
      type: 'text',
      rows: 6,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'bioEn', title: 'Biografia (inglese)', type: 'text', rows: 6 }),
    defineField({
      name: 'statementIt',
      title: 'Statement (italiano)',
      type: 'text',
      rows: 6,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'statementEn', title: 'Statement (inglese)', type: 'text', rows: 6 }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Collegamenti social',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'label', type: 'string', validation: (r) => r.required() }),
            defineField({
              name: 'url',
              type: 'url',
              validation: (r) => r.required().uri({ scheme: ['http', 'https'] }),
            }),
          ],
        },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'About' }) },
})
```

```ts
// sanity/schemas/siteSettings.ts
import { defineField, defineType } from 'sanity'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Impostazioni',
  type: 'document',
  fields: [
    defineField({
      name: 'photographerName',
      title: 'Nome del fotografo',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'seoTitleIt',
      title: 'Titolo SEO (italiano)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'seoTitleEn', title: 'Titolo SEO (inglese)', type: 'string' }),
    defineField({
      name: 'seoDescriptionIt',
      title: 'Descrizione SEO (italiano)',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'seoDescriptionEn', title: 'Descrizione SEO (inglese)', type: 'text', rows: 3 }),
    defineField({
      name: 'socialImage',
      title: 'Immagine social predefinita',
      type: 'image',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email di fallback',
      type: 'string',
      validation: (rule) => rule.email(),
    }),
  ],
  preview: { prepare: () => ({ title: 'Impostazioni' }) },
})
```

- [ ] **Step 4: Creare l'indice degli schemi**

```ts
// sanity/schemas/index.ts
import { photo } from './photo'
import { project } from './project'
import { homePage } from './homePage'
import { aboutPage } from './aboutPage'
import { siteSettings } from './siteSettings'

export const schemaTypes = [photo, project, homePage, aboutPage, siteSettings]
```

- [ ] **Step 5: Verificare la compilazione**

```bash
npm run typecheck
```

Atteso: nessun errore. Se `orderRankField` non è risolto, controllare che `@sanity/orderable-document-list` sia installato alla versione `^2` (peer `sanity ^5 || ^6`).

- [ ] **Step 6: Commit**

```bash
git add sanity/schemas
git commit -m "feat: schemi Sanity per fotografia, progetto e i tre singleton"
```

---

## Task 16: Studio embedded con desk structure

**Files:**
- Create: `sanity.config.ts`, `sanity/structure/deskStructure.ts`, `app/studio/layout.tsx`, `app/studio/[[...tool]]/page.tsx`

- [ ] **Step 1: Creare la desk structure**

```ts
// sanity/structure/deskStructure.ts
import type { StructureResolver } from 'sanity/structure'
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list'

const SINGLETONS = [
  { id: 'homePage', title: 'Homepage' },
  { id: 'aboutPage', title: 'About' },
  { id: 'siteSettings', title: 'Impostazioni' },
] as const

export const deskStructure: StructureResolver = (S, context) =>
  S.list()
    .title('Contenuti')
    .items([
      S.listItem()
        .title('Homepage')
        .id('homePage')
        .child(S.document().schemaType('homePage').documentId('homePage')),

      orderableDocumentListDeskItem({
        type: 'photo',
        title: 'Fotografie',
        S,
        context,
      }),

      S.documentTypeListItem('project').title('Progetti'),

      S.listItem()
        .title('About')
        .id('aboutPage')
        .child(S.document().schemaType('aboutPage').documentId('aboutPage')),

      S.listItem()
        .title('Impostazioni')
        .id('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])

export const SINGLETON_TYPES = new Set(SINGLETONS.map((s) => s.id))
```

La struttura espone esattamente cinque voci, come richiede la specifica di prodotto §10.

- [ ] **Step 2: Creare `sanity.config.ts`**

```ts
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemas'
import { deskStructure, SINGLETON_TYPES } from './sanity/structure/deskStructure'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!

export default defineConfig({
  name: 'default',
  title: 'Andrea Gallato',
  basePath: '/studio',
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    // I singleton non compaiono nel menu "crea nuovo"
    templates: (prev) => prev.filter((t) => !SINGLETON_TYPES.has(t.schemaType)),
  },
  document: {
    // I singleton non sono duplicabili né eliminabili
    actions: (prev, { schemaType }) =>
      SINGLETON_TYPES.has(schemaType)
        ? prev.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : prev,
  },
  plugins: [
    structureTool({ structure: deskStructure }),
    ...(process.env.NODE_ENV === 'development' ? [visionTool()] : []),
  ],
})
```

- [ ] **Step 3: Installare Vision**

```bash
npm install -D @sanity/vision
```

- [ ] **Step 4: Creare il root layout dello Studio**

```tsx
// app/studio/layout.tsx
export const metadata = {
  title: 'Studio — Andrea Gallato',
  robots: { index: false, follow: false },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
```

Questo è un **secondo root layout**, necessario perché il root layout del sito vive sotto `app/[locale]/` e non copre `/studio`. La navigazione fra due root layout provoca un full page load, accettabile fra sito e Studio.

- [ ] **Step 5: Montare lo Studio**

```tsx
// app/studio/[[...tool]]/page.tsx
import { NextStudio } from 'next-sanity/studio'
import config from '@/sanity.config'

export const dynamic = 'force-static'

export { metadata, viewport } from 'next-sanity/studio'

export default function StudioPage() {
  return <NextStudio config={config} />
}
```

- [ ] **Step 6: Verificare che lo Studio si avvii**

```bash
npm run dev
```

Aprire `http://localhost:3000/studio`. Atteso: schermata di login Sanity, poi la struttura con esattamente cinque voci. Verificare che Homepage, About e Impostazioni non offrano «Duplica» né «Elimina».

Se lo Studio non parte con un errore su `styled-components`, verificare che sia installato: è peer obbligatorio di `sanity`.

- [ ] **Step 7: Configurare CORS**

Aggiungere `http://localhost:3000` alle origini consentite:

```bash
npx sanity@latest cors add http://localhost:3000 --credentials
```

- [ ] **Step 8: Commit**

```bash
git add sanity.config.ts sanity/structure app/studio package.json package-lock.json
git commit -m "feat: Studio embedded con cinque voci e singleton non duplicabili"
```

---

## Task 17: Client Sanity, `sanityFetch` e TypeGen

**Files:**
- Create: `lib/sanity/client.ts`, `lib/sanity/fetch.ts`, `lib/sanity/queries.ts`
- Test: `lib/sanity/__tests__/fetch.test.ts`

- [ ] **Step 1: Creare i due client**

```ts
// lib/sanity/client.ts
import { createClient } from '@sanity/client'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION!

export const publicClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: 'published',
})

export const previewClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: 'drafts',
  token: process.env.SANITY_API_READ_TOKEN,
})
```

`useCdn: false` su entrambi, per due ragioni distinte del design §5.1. Sul client di anteprima è **obbligatorio**: la perspective `drafts` lo richiede. Sul client pubblico è deliberato: con la revalidation per tag, il CDN può servire una risposta pre-pubblicazione subito dopo che il webhook ha scaduto la voce di cache, e Next ricacherebbe quel contenuto stale a tempo indeterminato. Da non «ottimizzare» a `true` in seguito.

- [ ] **Step 2: Creare `sanityFetch`**

```ts
// lib/sanity/fetch.ts
import type { QueryParams } from '@sanity/client'
import { publicClient } from './client'

export async function sanityFetch<const Q extends string>({
  query,
  params = {},
  tags = [],
}: {
  query: Q
  params?: QueryParams
  tags?: string[]
}) {
  return publicClient.fetch(query, params, {
    cache: 'force-cache',
    next: { tags, revalidate: false },
  })
}
```

Due dettagli non negoziabili del design §5.1:

- **`const Q extends string`** preserva il tipo letterale della query. Senza, l'overload di `client.fetch` generato da TypeGen non si aggancia e ogni chiamata restituisce `any`, silenziosamente, perché `any` si propaga senza errori di compilazione.
- **`cache: 'force-cache'`** è necessario: il caching di `fetch` non è attivo per default e i tag da soli non sono un opt-in al Data Cache. Senza, `revalidateTag` non avrebbe nulla da invalidare — un fallimento invisibile in sviluppo che si manifesta solo in produzione.

`sanityFetch` **non chiama mai `draftMode()`**: se lo facesse, essendo l'unico punto di accesso ai dati, ogni pagina del sito diventerebbe dinamica per tutti i visitatori. L'anteprima è isolata e arriva in Fase 3.

- [ ] **Step 3: Scrivere il test che fissa il contratto**

```ts
// lib/sanity/__tests__/fetch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchSpy = vi.fn(async () => ({ ok: true }))

vi.mock('../client', () => ({
  publicClient: { fetch: (...args: unknown[]) => fetchSpy(...(args as [])) },
  previewClient: { fetch: vi.fn() },
}))

const { sanityFetch } = await import('../fetch')

describe('sanityFetch', () => {
  beforeEach(() => fetchSpy.mockClear())

  it('richiede esplicitamente la cache, altrimenti i tag non invalidano nulla', async () => {
    await sanityFetch({ query: '*[_type=="photo"]', tags: ['gallery'] })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>]
    expect(options.cache).toBe('force-cache')
  })

  it('passa i tag e disattiva la revalidation a tempo, che è mutuamente esclusiva', async () => {
    await sanityFetch({ query: '*[_type=="photo"]', tags: ['gallery', 'photo:abc'] })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, { next: Record<string, unknown> }]
    expect(options.next.tags).toEqual(['gallery', 'photo:abc'])
    expect(options.next.revalidate).toBe(false)
  })

  it('usa un array di tag vuoto quando non ne vengono passati', async () => {
    await sanityFetch({ query: '*[_type=="photo"]' })

    const [, , options] = fetchSpy.mock.calls[0] as unknown as [string, unknown, { next: Record<string, unknown> }]
    expect(options.next.tags).toEqual([])
  })
})
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run lib/sanity/__tests__/fetch.test.ts
```

Atteso: PASS, 3 test.

- [ ] **Step 5: Creare le query di Fase 1A**

```ts
// lib/sanity/queries.ts
import { defineQuery } from 'next-sanity'

export const siteSettingsQuery = defineQuery(`
  *[_type == "siteSettings"][0]{
    photographerName,
    seoTitleIt, seoTitleEn,
    seoDescriptionIt, seoDescriptionEn,
    email
  }
`)

export const homePageQuery = defineQuery(`
  *[_type == "homePage"][0]{
    introIt, introEn
  }
`)
```

Le query che leggono immagini arrivano nel piano 1B e includeranno sempre `asset->metadata.dimensions` e `asset->metadata.lqip`.

- [ ] **Step 6: Generare i tipi**

```bash
npm run sanity:typegen
```

Atteso: riporta un numero di query trovate **maggiore di zero**. Se riporta zero, la configurazione `typegen.path` in `sanity.cli.ts` non corrisponde alla struttura del repository — i default puntano a `./src/**`, che qui non esiste.

```bash
npm run typecheck
```

Atteso: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add lib/sanity sanity.cli.ts package.json
git commit -m "feat: client Sanity, sanityFetch con cache esplicita e TypeGen"
```

---

## Task 18: Collegare `siteSettings` e `homePage` alle viste

**Files:**
- Modify: `app/[locale]/layout.tsx`, `views/HomeView.tsx`, `app/[locale]/[[...segments]]/page.tsx`

- [ ] **Step 1: Leggere `siteSettings` nel layout**

Sostituire il corpo di `LocaleLayout` in `app/[locale]/layout.tsx`:

```tsx
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const settings = await sanityFetch({
    query: siteSettingsQuery,
    tags: ['settings'],
  })

  const siteName = settings?.photographerName ?? 'Andrea Gallato'

  return (
    <html lang={locale} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script type="text/javascript" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SkipLink label={dict.skipToContent} />
        <Header locale={locale} siteName={siteName} />
        <main id="main">{children}</main>
        <Footer locale={locale} siteName={siteName} email={settings?.email ?? undefined} />
      </body>
    </html>
  )
```

Aggiungere gli import:

```tsx
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'
```

Il fallback letterale `'Andrea Gallato'` copre il caso in cui `siteSettings` non sia ancora stato creato: il design §13 richiede che un riferimento mancante non rompa la pagina. Fuori da questo fallback il nome vive solo in Sanity.

- [ ] **Step 2: Leggere `homePage` nella vista**

```tsx
// views/HomeView.tsx
import { type Locale } from '@/lib/i18n/locales'
import { pickLocalized } from '@/lib/i18n/localize'
import { sanityFetch } from '@/lib/sanity/fetch'
import { homePageQuery } from '@/lib/sanity/queries'
import styles from './HomeView.module.css'

export async function HomeView({ locale, siteName }: { locale: Locale; siteName: string }) {
  const home = await sanityFetch({ query: homePageQuery, tags: ['home'] })

  const intro = pickLocalized({ it: home?.introIt, en: home?.introEn }, locale)

  return (
    <div className={styles.home}>
      <h1 className={styles.title}>{siteName}</h1>
      {intro.value ? (
        <p className={styles.intro} lang={intro.lang === locale ? undefined : intro.lang}>
          {intro.value}
        </p>
      ) : null}
    </div>
  )
}
```

`lang` è emesso **solo quando la lingua del testo differisce da quella della pagina**: è il meccanismo che rende conforme il fallback EN→IT rispetto a WCAG 3.1.2. Emetterlo sempre sarebbe rumore inutile nel markup.

- [ ] **Step 3: Passare `siteName` alla vista**

In `app/[locale]/[[...segments]]/page.tsx`, la homepage ha bisogno del nome. Leggere le impostazioni anche qui:

```tsx
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'

// dentro Page, dopo la risoluzione della rotta:
  switch (route.key) {
    case 'home': {
      const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })
      return <HomeView locale={locale} siteName={settings?.photographerName ?? 'Andrea Gallato'} />
    }
    default:
      notFound()
  }
```

Non è una query duplicata a runtime: entrambe le chiamate hanno la stessa query, gli stessi parametri e lo stesso tag, quindi condividono la stessa voce di Data Cache.

- [ ] **Step 4: Verificare la compilazione**

```bash
npm run typecheck && npm test
```

Atteso: nessun errore di tipo, tutti i test passano.

- [ ] **Step 5: Commit**

```bash
git add app views
git commit -m "feat: legge nome e introduzione da Sanity con marcatura lang del fallback"
```

---

## Task 19: `nextOrderRank`

**Files:**
- Create: `sanity/lib/orderRank.ts`
- Test: `sanity/lib/__tests__/orderRank.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// sanity/lib/__tests__/orderRank.test.ts
import { describe, it, expect, vi } from 'vitest'
import { nextOrderRank } from '../orderRank'

function clientReturning(value: string | null) {
  return { fetch: vi.fn(async () => value) } as unknown as Parameters<typeof nextOrderRank>[0]
}

describe('nextOrderRank', () => {
  it('produce un rank quando il dataset è vuoto', async () => {
    const rank = await nextOrderRank(clientReturning(null), 'photo')
    expect(typeof rank).toBe('string')
    expect(rank.length).toBeGreaterThan(0)
  })

  it('produce un rank successivo a quello esistente', async () => {
    const first = await nextOrderRank(clientReturning(null), 'photo')
    const second = await nextOrderRank(clientReturning(first), 'photo')
    expect(second > first).toBe(true)
  })

  it('produce rank crescenti su chiamate successive', async () => {
    let last: string | null = null
    const ranks: string[] = []
    for (let i = 0; i < 5; i++) {
      last = await nextOrderRank(clientReturning(last), 'photo')
      ranks.push(last)
    }
    expect([...ranks].sort()).toEqual(ranks)
    expect(new Set(ranks).size).toBe(5)
  })

  it('interroga il rank massimo del tipo richiesto', async () => {
    const client = clientReturning(null)
    await nextOrderRank(client, 'photo')
    const query = (client.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(query).toContain('photo')
    expect(query).toContain('orderRank')
  })
})
```

Questo è il difetto che la revisione del design ha scoperto e che va prevenuto alla radice: il plugin di ordinamento popola `orderRank` **solo** tramite `initialValue`, che gira unicamente quando il documento nasce dal form dello Studio. Una fotografia creata dal seed o dal tool di upload nascerebbe senza rank, apparirebbe al 20% di opacità nello Studio, non sarebbe trascinabile, e finirebbe in una posizione arbitraria nella galleria pubblica.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run sanity/lib/__tests__/orderRank.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// sanity/lib/orderRank.ts
import { LexoRank } from 'lexorank'
import type { SanityClient } from '@sanity/client'

/**
 * Calcola il rank di ordinamento successivo per un tipo di documento.
 *
 * Va usato da OGNI percorso di creazione programmatica (script di seed,
 * tool "Carica fotografie"): @sanity/orderable-document-list popola
 * orderRank solo tramite initialValue, che gira soltanto quando il
 * documento nasce dal form dello Studio.
 */
export async function nextOrderRank(
  client: Pick<SanityClient, 'fetch'>,
  type: string,
): Promise<string> {
  const highest = await client.fetch<string | null>(
    `*[_type == $type && defined(orderRank)] | order(orderRank desc)[0].orderRank`,
    { type },
  )

  return highest
    ? LexoRank.parse(highest).genNext().toString()
    : LexoRank.middle().toString()
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run sanity/lib/__tests__/orderRank.test.ts
```

Atteso: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
git add sanity/lib
git commit -m "feat: nextOrderRank per le creazioni programmatiche di documenti ordinabili"
```

---

## Task 20: Generazione dei placeholder

**Files:**
- Create: `scripts/seed/generatePlaceholders.ts`
- Test: `scripts/seed/__tests__/generatePlaceholders.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// scripts/seed/__tests__/generatePlaceholders.test.ts
import { describe, it, expect } from 'vitest'
import { buildPlaceholderPlan, ASPECT_RATIOS } from '../generatePlaceholders'

describe('buildPlaceholderPlan', () => {
  it('produce esattamente il numero richiesto di immagini', () => {
    expect(buildPlaceholderPlan(30)).toHaveLength(30)
  })

  it('usa tutti i rapporti d aspetto previsti', () => {
    const plan = buildPlaceholderPlan(30)
    const used = new Set(plan.map((p) => p.ratioName))
    expect(used.size).toBe(ASPECT_RATIOS.length)
  })

  it('non supera mai 4000px sul lato lungo', () => {
    for (const p of buildPlaceholderPlan(30)) {
      expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(4000)
    }
  })

  it('produce dimensioni intere', () => {
    for (const p of buildPlaceholderPlan(30)) {
      expect(Number.isInteger(p.width)).toBe(true)
      expect(Number.isInteger(p.height)).toBe(true)
    }
  })

  it('rispetta il rapporto d aspetto entro un pixel di arrotondamento', () => {
    for (const p of buildPlaceholderPlan(30)) {
      const actual = p.width / p.height
      expect(Math.abs(actual - p.ratio)).toBeLessThan(0.01)
    }
  })

  it('produce nomi di file univoci', () => {
    const plan = buildPlaceholderPlan(30)
    expect(new Set(plan.map((p) => p.filename)).size).toBe(30)
  })

  it('è deterministico', () => {
    expect(buildPlaceholderPlan(12)).toEqual(buildPlaceholderPlan(12))
  })
})
```

Il limite di 4000px sul lato lungo è la linea guida operativa della specifica di prodotto §11. Il determinismo serve perché il seed deve essere idempotente.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run scripts/seed/__tests__/generatePlaceholders.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere il pianificatore e il generatore**

```ts
// scripts/seed/generatePlaceholders.ts
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const ASPECT_RATIOS = [
  { name: '16-9', ratio: 16 / 9 },
  { name: '3-2', ratio: 3 / 2 },
  { name: '1-1', ratio: 1 },
  { name: '4-5', ratio: 4 / 5 },
  { name: '2-3', ratio: 2 / 3 },
] as const

export const MAX_LONG_EDGE = 4000

export type PlaceholderSpec = {
  filename: string
  ratioName: string
  ratio: number
  width: number
  height: number
  hue: number
}

export function buildPlaceholderPlan(count: number): PlaceholderSpec[] {
  const plan: PlaceholderSpec[] = []

  for (let i = 0; i < count; i++) {
    const { name, ratio } = ASPECT_RATIOS[i % ASPECT_RATIOS.length]

    // Lato lungo variabile ma deterministico, entro il limite operativo.
    const longEdge = 2400 + ((i * 317) % (MAX_LONG_EDGE - 2400))

    const width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio)
    const height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge

    plan.push({
      filename: `placeholder-${String(i + 1).padStart(3, '0')}-${name}.jpg`,
      ratioName: name,
      ratio,
      width,
      height,
      hue: (i * 37) % 360,
    })
  }

  return plan
}

export const OUTPUT_DIR = path.join(process.cwd(), 'scripts/seed/generated')

export async function generatePlaceholders(count: number): Promise<string[]> {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const plan = buildPlaceholderPlan(count)
  const written: string[] = []

  for (const spec of plan) {
    const buffer = await sharp({
      create: {
        width: spec.width,
        height: spec.height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: spec.width,
              height: spec.height,
              channels: 3,
              background: hslToRgb(spec.hue, 0.18, 0.32),
            },
          },
          blend: 'over',
        },
      ])
      .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
      .withMetadata({ icc: 'srgb' })
      .toBuffer()

    const filePath = path.join(OUTPUT_DIR, spec.filename)
    await writeFile(filePath, buffer)
    written.push(filePath)
  }

  return written
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x]

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}
```

`withMetadata({ icc: 'srgb' })` rispetta il requisito sRGB della specifica di prodotto §11.

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run scripts/seed/__tests__/generatePlaceholders.test.ts
```

Atteso: PASS, 7 test.

- [ ] **Step 5: Verificare che le immagini vengano prodotte davvero**

```bash
npx tsx -e "import('./scripts/seed/generatePlaceholders.ts').then(m => m.generatePlaceholders(5)).then(f => console.log(f.length, 'file'))"
```

Atteso: `5 file`. Verificare le dimensioni reali:

```bash
npx tsx -e "import('sharp').then(async ({default: sharp}) => { const m = await sharp('scripts/seed/generated/placeholder-001-16-9.jpg').metadata(); console.log(m.width, m.height, m.space) })"
```

Atteso: larghezza e altezza in rapporto 16:9, spazio colore `srgb`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed/generatePlaceholders.ts scripts/seed/__tests__
git commit -m "feat: generazione deterministica di placeholder sRGB a rapporti misti"
```

---

## Task 21: Popolamento del dataset

**Files:**
- Create: `scripts/seed/seedDataset.ts`

- [ ] **Step 1: Scrivere lo script**

```ts
// scripts/seed/seedDataset.ts
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { createClient } from '@sanity/client'
import { buildPlaceholderPlan, generatePlaceholders, OUTPUT_DIR } from './generatePlaceholders'
import { nextOrderRank } from '../../sanity/lib/orderRank'

const PHOTO_COUNT = Number(process.env.SEED_COUNT ?? 30)
const dataset = process.env.SEED_DATASET

if (!dataset) {
  console.error('SEED_DATASET è obbligatorio. Esempio: SEED_DATASET=development npm run seed')
  process.exit(1)
}

if (dataset === 'production') {
  console.error('Rifiuto di popolare production con placeholder.')
  process.exit(1)
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  token: process.env.SANITY_WRITE_TOKEN!,
  useCdn: false,
})

async function main() {
  console.log(`Genero ${PHOTO_COUNT} placeholder…`)
  await generatePlaceholders(PHOTO_COUNT)
  const plan = buildPlaceholderPlan(PHOTO_COUNT)

  const photoIds: string[] = []

  for (const [index, spec] of plan.entries()) {
    // _id deterministico: rieseguire lo script non duplica i documenti.
    const id = `seed-photo-${String(index + 1).padStart(3, '0')}`

    const existing = await client.fetch<{ _id: string } | null>(
      `*[_id == $id][0]{_id}`,
      { id },
    )

    if (existing) {
      photoIds.push(id)
      console.log(`  ${spec.filename} già presente, salto`)
      continue
    }

    const asset = await client.assets.upload(
      'image',
      createReadStream(path.join(OUTPUT_DIR, spec.filename)),
      { filename: spec.filename },
    )

    const orderRank = await nextOrderRank(client, 'photo')

    await client.createOrReplace({
      _id: id,
      _type: 'photo',
      image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
      altIt: `Placeholder ${index + 1}, rapporto ${spec.ratioName}`,
      altEn: `Placeholder ${index + 1}, ratio ${spec.ratioName}`,
      titleIt: `Studio ${index + 1}`,
      placeIt: 'Veneto',
      year: 2020 + (index % 6),
      showInGallery: true,
      orderRank,
    })

    photoIds.push(id)
    console.log(`  ${spec.filename} → ${id}`)
  }

  await client.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    photographerName: 'Andrea Gallato',
    seoTitleIt: 'Andrea Gallato — Fotografia',
    seoTitleEn: 'Andrea Gallato — Photography',
    seoDescriptionIt: 'Fotografia di paesaggio, street e ritratto.',
    seoDescriptionEn: 'Landscape, street and portrait photography.',
    email: 'info@example.com',
  })

  await client.createOrReplace({
    _id: 'homePage',
    _type: 'homePage',
    heroPhoto: { _type: 'reference', _ref: photoIds[0] },
    introIt: 'Fotografia di paesaggio, street e ritratto.',
    introEn: 'Landscape, street and portrait photography.',
    selectedPhotos: photoIds.slice(0, 6).map((ref, i) => ({
      _type: 'reference',
      _ref: ref,
      _key: `sel-${i}`,
    })),
  })

  console.log(`\nFatto. ${photoIds.length} fotografie sul dataset "${dataset}".`)
  console.log('Nota: siteSettings non ha socialImage, che è obbligatoria per la pubblicazione.')
  console.log('Va caricata a mano dallo Studio prima di testare la pubblicazione.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

Tre proprietà volute:

- **Il dataset è un parametro obbligatorio e `production` è rifiutato** (design §15.6). Un default silenzioso sarebbe il modo più semplice di riempire di placeholder il dataset reale.
- **`_id` deterministici più controllo di esistenza**: rieseguire lo script non duplica nulla.
- **`orderRank` esplicito su ogni fotografia**: senza, le foto sarebbero non trascinabili nello Studio e in ordine arbitrario sul sito.

- [ ] **Step 2: Creare un token di scrittura**

Da <https://www.sanity.io/manage> → API → Tokens, creare un token con permesso **Editor**, e aggiungerlo a `.env.local` come `SANITY_WRITE_TOKEN`. Aggiungerlo anche a `.env.example` con valore vuoto.

Questo token ha permessi di scrittura: resta esclusivamente lato server, non ha prefisso `NEXT_PUBLIC_`, e serve solo agli script locali.

- [ ] **Step 3: Eseguire il seed sul dataset di sviluppo**

```bash
SEED_DATASET=development npx dotenv -e .env.local -- npm run seed
```

Se `dotenv-cli` non è installato:

```bash
npm install -D dotenv-cli
```

Atteso: 30 righe di caricamento, poi il riepilogo.

- [ ] **Step 4: Verificare nello Studio**

```bash
npm run dev
```

Aprire `http://localhost:3000/studio` → Fotografie. Atteso: 30 fotografie, **tutte a piena opacità e trascinabili**. Se appaiono al 20% di opacità e non si trascinano, `orderRank` non è stato scritto: è il difetto che la Task 19 previene.

Trascinare una fotografia in cima e verificare che l'ordine persista dopo un ricaricamento.

- [ ] **Step 5: Rieseguire il seed per verificare l'idempotenza**

```bash
SEED_DATASET=development npx dotenv -e .env.local -- npm run seed
```

Atteso: tutte le righe dicono «già presente, salto». Nello Studio ci sono ancora **30** fotografie, non 60, e l'ordine manuale impostato allo step precedente è intatto.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed/seedDataset.ts .env.example package.json package-lock.json
git commit -m "feat: seed idempotente con orderRank esplicito e rifiuto di production"
```

---

## Task 22: End-to-end di navigazione, tema e 404

**Files:**
- Create: `playwright.config.ts`, `e2e/navigation.spec.ts`, `e2e/theme.spec.ts`, `e2e/a11y.spec.ts`

- [ ] **Step 1: Creare `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

`workers: 1` e `fullyParallel: false` sono richiesti dal design §15.4: i test che scrivono su Sanity non sono isolabili con esecuzione parallela. Il `webServer` usa `build` + `start` e non `dev`, perché la Data Cache — che serve dalla Fase 2 — esiste solo in un build di produzione.

- [ ] **Step 2: Installare i browser**

```bash
npx playwright install --with-deps chromium webkit
```

- [ ] **Step 3: Scrivere gli e2e di navigazione**

```ts
// e2e/navigation.spec.ts
import { test, expect } from '@playwright/test'

test('la radice reindirizza alla home italiana', async ({ page }) => {
  const response = await page.goto('/')
  expect(page.url()).toContain('/it')
  expect(response?.status()).toBe(200)
})

test('la home italiana dichiara lang="it"', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
})

test('la home inglese dichiara lang="en"', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il selettore lingua porta alla pagina equivalente', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('il nome canonico interno restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/gallery')
  expect(response?.status()).toBe(404)
})

test('il segmento della lingua sbagliata restituisce 404', async ({ page }) => {
  const response = await page.goto('/it/photographs')
  expect(response?.status()).toBe(404)
})

test('un locale non supportato restituisce 404', async ({ page }) => {
  const response = await page.goto('/fr')
  expect(response?.status()).toBe(404)
})

test('gli href del selettore lingua sono corretti nell HTML senza JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/it')

  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en')
  await context.close()
})

test('lo skip link diventa visibile al primo Tab e porta al contenuto', async ({ page }) => {
  await page.goto('/it')
  await page.keyboard.press('Tab')

  const skip = page.getByRole('link', { name: 'Vai al contenuto' })
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page).toHaveURL(/#main$/)
})
```

Il test sugli status 404 è quello che verifica davvero la scelta architetturale della catch-all: una soluzione basata su rewrite avrebbe restituito 200 su una pagina d'errore (soft-404).

Il test senza JavaScript verifica che il selettore lingua funzioni per i crawler e prima dell'idratazione.

- [ ] **Step 4: Scrivere gli e2e del tema**

```ts
// e2e/theme.spec.ts
import { test, expect } from '@playwright/test'

test('parte in tema scuro alla prima visita', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('passa al tema chiaro e lo comunica con aria-pressed', async ({ page }) => {
  await page.goto('/it')
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('ricorda la preferenza dopo un ricaricamento, senza flash', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await page.reload()

  // Verificato prima di qualunque attesa: lo script inline deve avere già
  // impostato l attributo al primo paint, non dopo l idratazione.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('mantiene la preferenza attraverso la navigazione', async ({ page }) => {
  await page.goto('/it')
  await page.getByRole('button', { name: 'Tema chiaro' }).click()

  await page.getByRole('link', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('il nome accessibile del toggle non cambia con lo stato', async ({ page }) => {
  await page.goto('/it')
  const toggle = page.getByRole('button', { name: 'Tema chiaro' })

  await toggle.click()
  await expect(page.getByRole('button', { name: 'Tema chiaro' })).toBeVisible()
})
```

- [ ] **Step 5: Scrivere lo scan di accessibilità**

```ts
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = ['/it', '/en']
const THEMES = ['dark', 'light'] as const

for (const path of PAGES) {
  for (const theme of THEMES) {
    test(`nessuna violazione axe su ${path} in tema ${theme}`, async ({ page }) => {
      await page.goto(path)

      if (theme === 'light') {
        await page.getByRole('button', { name: /Tema chiaro|Light theme/ }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}
```

Il design §15.5 richiede che gli scan girino **in entrambi i temi**: un contrasto insufficiente esiste solo in uno dei due, e scansionare il solo tema di default lo nasconderebbe.

- [ ] **Step 6: Eseguire la suite**

```bash
npm run e2e
```

Atteso: tutti i test passano su chromium, webkit e iphone. Le violazioni axe eventualmente trovate vanno **corrette**, non silenziate: sono nel codice appena scritto e correggerle ora costa meno che in Fase 3.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test: e2e di navigazione, 404, tema e accessibilità in entrambi i temi"
```

---

## Task 23: Verifiche di checkpoint

Il design §16 richiede che alcune proprietà siano **verificate**, non assunte. Questa task non produce codice: produce prove.

- [ ] **Step 1: Verificare la generazione statica**

```bash
npm run build
```

Nell'output, la sezione delle rotte deve mostrare `/[locale]` come prerenderizzata (simbolo di static o SSG) con `/it` e `/en` fra i percorsi generati. Se compare come dinamica (ƒ), qualcosa ha introdotto una Dynamic API in un Server Component — il sospetto principale è una chiamata a `draftMode()`, `headers()` o `cookies()` finita in `sanityFetch` o nel layout.

Annotare l'esito nel commit.

- [ ] **Step 2: Verificare che la cache dei dati funzioni**

```bash
npm run build && npm run start
```

In un altro terminale:

```bash
curl -sI http://localhost:3000/it | grep -i x-nextjs-cache
curl -sI http://localhost:3000/it | grep -i x-nextjs-cache
```

Atteso: la seconda richiesta riporta `HIT`. Se entrambe riportano `MISS`, il Data Cache non si sta popolando: rileggere `lib/sanity/fetch.ts` e verificare che `cache: 'force-cache'` sia effettivamente passato. È il fallimento silenzioso descritto nel design §5.1, invisibile in sviluppo.

- [ ] **Step 3: Verificare l'assenza di flash del tema**

Con il server di produzione attivo, impostare il tema chiaro, poi ricaricare la pagina osservando i primi fotogrammi. Non deve comparire alcun lampo scuro.

Registrarlo con Playwright per averne una prova:

```bash
npx playwright test e2e/theme.spec.ts --project=chromium --trace on
npx playwright show-trace
```

Nella traccia, controllare gli screenshot dei primi fotogrammi dopo il reload.

- [ ] **Step 4: Verificare la scala dello Studio**

Popolare il dataset `e2e` con 500 documenti e misurare:

```bash
SEED_DATASET=e2e SEED_COUNT=500 npx dotenv -e .env.local -- npm run seed
```

Aprire lo Studio puntando al dataset `e2e` e cronometrare il primo render dell'elenco Fotografie. Il design §11.1 fissa la soglia di guardia a 150 fotografie: se a 500 il pannello è inutilizzabile, la soglia è confermata e va registrata nella guida editoriale. Se invece regge, alzarla nel documento.

Questa misura non blocca la Fase 1A: serve a sostituire una stima con un dato prima che il catalogo cresca.

- [ ] **Step 5: Eseguire l'intera suite**

```bash
npm run typecheck && npm test && npm run e2e
```

Atteso: tutto verde. Riportare i numeri reali (quanti test unitari, quanti e2e) invece di dire «passano».

- [ ] **Step 6: Commit finale**

```bash
git add -A
git commit -m "chore: verifiche di checkpoint della Fase 1A"
```

---

## Criteri di completamento della Fase 1A

La fase è completa quando **tutti** questi punti sono verificati con un comando eseguito, non con una lettura del codice:

1. `/` reindirizza a `/it` con status 308; `/it` e `/en` rendono la homepage con `<html lang>` corretto.
2. `/it/gallery`, `/it/photographs` e `/fr` restituiscono status **404**, non 200.
3. Il selettore lingua porta alla pagina equivalente e i suoi `href` sono corretti nell'HTML servito senza JavaScript.
4. Il tema scuro è il default; il passaggio al chiaro persiste attraverso ricaricamenti e navigazioni, senza flash.
5. Lo skip link è il primo elemento focalizzabile e porta al contenuto.
6. Gli scan axe non riportano violazioni su `/it` e `/en`, in entrambi i temi.
7. Lo Studio a `/studio` mostra esattamente cinque voci; Homepage, About e Impostazioni non sono duplicabili né eliminabili.
8. Il dataset `development` contiene 30 fotografie, tutte trascinabili nello Studio, e rieseguire il seed non le duplica.
9. `npm run build` mostra le rotte come prerenderizzate.
10. L'header `x-nextjs-cache` riporta `HIT` alla seconda richiesta.
11. `npm run typecheck`, `npm test` e `npm run e2e` passano tutti.

## Cosa consegna il piano 1B

Pipeline immagini (loader custom, `deviceSizes`, `SanityImage` con `loader` esplicito), `packRows` e `sizesForTile`, galleria a righe giustificate, «Carica altre» con regione di stato e gestione del focus, lightbox su `<dialog>` con blocco scroll iOS-safe, fotografia protagonista della homepage, menu mobile, e l'header che riceve la rotta corrente per far puntare il selettore lingua alla pagina equivalente.

---

## Self-review

**Copertura della spec di Fase 1** (design §16): toolchain e versioni pinnate → Task 1; Node 24 → Task 1; progetto Sanity e tre dataset → Task 3; `.env.example` → Task 3; design token compresi focus e target → Task 4; tema anti-flash → Task 9, 10, 11; routing con catch-all e dizionario → Task 6, 14; schemi Sanity completi → Task 15; Studio con desk structure e ordinamento → Task 16; script di seed → Task 20, 21; test unitari e di componenti → Task 5–13, 17, 19, 20; scan axe → Task 22; verifiche di checkpoint → Task 23.

**Rinviato esplicitamente al piano 1B** e non lasciato implicito: `SanityImage` e pipeline immagini, homepage con fotografia protagonista, `packRows` e galleria, «Carica altre», lightbox, menu mobile.

**Consistenza dei tipi:** `Locale` da `lib/i18n/locales.ts` è usato in `routes.ts`, `localize.ts`, `dictionaries/index.ts`, `Header`, `Footer`, `LocaleSwitcher`, `HomeView`. `Resolved` da `routes.ts` è consumato da `pathFor` e `alternatePaths`. `Theme` e `THEME_STORAGE_KEY` da `lib/theme/script.ts` sono usati da `ThemeToggle` e dai suoi test. `Dictionary` è derivato da `it.ts` e imposto a `en.ts` a compile time. `nextOrderRank(client, type)` ha la stessa firma nel test, nell'implementazione e nell'uso da `seedDataset.ts`.

**Punti da confermare in esecuzione, marcati nel piano e non nascosti:** i flag esatti di `sanity init` (Task 3, Step 1 li fa verificare prima dell'uso); il comportamento di `not-found.tsx` senza `params`, che rende la 404 bilingue invece che monolingue (Task 14, Step 5, con la decisione rinviata alla Fase 2).
