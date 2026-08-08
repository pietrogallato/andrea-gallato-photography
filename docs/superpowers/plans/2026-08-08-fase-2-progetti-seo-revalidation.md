# Fase 2 — Progetti, SEO e revalidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare il sito pubblico — progetti fotografici, metadati SEO completi, sitemap — e chiudere il ciclo editoriale con un webhook che aggiorna solo le pagine coinvolte quando l'editor pubblica.

**Architecture:** Le pagine di progetto riusano la lightbox e la pipeline immagini della Fase 1B; la logica di stato della lightbox viene estratta in un hook condiviso, perché galleria e progetti la usano con impaginazioni diverse. La revalidation è per tag: la proiezione GROQ del webhook non può contenere sotto-query, quindi produce solo i tag diretti, e le dipendenze inverse vengono risolte dal route handler con una query server-side.

**Tech Stack:** Next 16.3, React 19.2, TypeScript strict, Sanity 6.9, `@sanity/webhook` v4, CSS Modules, Vitest + Testing Library, Playwright.

**Documenti normativi:**
- [Design implementativo](../specs/2026-08-07-portfolio-fotografico-design.md) — §5.2 tag, §5.3 webhook, §10 SEO, §13 resilienza
- [Specifica di prodotto](../../../portfolio-fotografico-design.md) — §4 mappa di revalidation, §6 URL e hreflang, §8.4 progetti, §12 stati di errore

**Stato di partenza, verificato l'8 agosto 2026:** Fase 1 completa e pubblicata su `https://andrea-gallato-photography.vercel.app`. 162 test unitari, 138 e2e su quattro ambienti, zero violazioni axe. Rotte prerenderizzate come SSG. Dataset `development` con 30 fotografie, `homePage`, `aboutPage`, `siteSettings`.

**Fuori ambito** (Fase 3): tool «Carica fotografie», document action con report delle bozze, anteprima autenticata, e2e che entrano nello Studio.

---

## Perché l'ordine è questo

I primi due task sono prerequisiti di dataset, non funzionalità. Senza documenti `project` le pagine progetto non hanno nulla da rendere e i loro test non possono dire niente; senza `socialImage` le anteprime social — obiettivo dichiarato di questa fase — non sono verificabili e `siteSettings` non supera nemmeno le validazioni di pubblicazione.

Il webhook arriva per ultimo perché è l'unica parte che richiede un URL pubblico: va verificata sul deploy Vercel, non in locale, dato che Sanity non può raggiungere `localhost`.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `scripts/seed/seedDataset.ts` (modifica) | Progetti e `socialImage` |
| `lib/sanity/queries.ts` (modifica) | `projectsIndexQuery`, `projectBySlugQuery`, `projectSlugsQuery`, `sitemapQuery` |
| `lib/projects/toProject.ts` | Mapping da documento Sanity a modello di vista |
| `components/lightbox/useLightbox.ts` | Stato condiviso fra galleria e progetti |
| `views/ProjectsView.tsx` | Indice: copertine ampie, titolo, anno |
| `views/ProjectView.tsx` | Dettaglio: introduzione e sequenza verticale |
| `components/projects/ProjectSequence.tsx` | Client: sequenza verticale con lightbox |
| `lib/seo/metadata.ts` | `buildPageMetadata` — canonical, hreflang, Open Graph |
| `lib/sanity/imageUrl.ts` (modifica) | `buildSocialImageUrl` con formato fisso |
| `app/sitemap.ts`, `app/robots.ts` | Sitemap e regole robots |
| `lib/revalidation/tags.ts` | `directTagsFor` puro, `resolveDependentTags` asincrono |
| `app/api/revalidate/route.ts` | Verifica firma, applica i tag |

---

## Task 1: Seminare progetti e immagine social

**Files:**
- Modify: `scripts/seed/seedDataset.ts`

Senza questo task nulla del resto è verificabile.

- [ ] **Step 1: Aggiungere l'immagine social a `siteSettings`**

Nel blocco che crea `siteSettings`, prima della chiamata, caricare un asset dedicato e referenziarlo:

```ts
  const socialSpec = plan.find((s) => s.ratioName === '16-9') ?? plan[0]
  const socialAsset = await client.assets.upload(
    'image',
    createReadStream(path.join(OUTPUT_DIR, socialSpec.filename)),
    { filename: `social-${socialSpec.filename}` },
  )
```

e aggiungere al documento:

```ts
    socialImage: { _type: 'image', asset: { _type: 'reference', _ref: socialAsset._id } },
```

`socialImage` è obbligatoria per la pubblicazione (specifica di prodotto §10) e alimenta le anteprime social di questa fase. Finora mancava, e lo script lo segnalava a ogni esecuzione.

- [ ] **Step 2: Seminare due progetti**

Dopo la creazione di `homePage`:

```ts
  const progetti = [
    {
      id: 'seed-project-nebbia',
      slug: 'nebbia',
      titleIt: 'Nebbia',
      titleEn: 'Fog',
      descriptionIt:
        'Testo provvisorio, da sostituire dallo Studio. Qui va la descrizione del progetto.',
      descriptionEn:
        'Placeholder text, to be replaced from the Studio. This is where the project description goes.',
      year: 2023,
      photos: photoIds.slice(0, 7),
      featured: true,
    },
    {
      id: 'seed-project-citta',
      slug: 'citta',
      titleIt: 'Città',
      titleEn: 'City',
      descriptionIt:
        'Testo provvisorio, da sostituire dallo Studio. Qui va la descrizione del progetto.',
      descriptionEn: null,
      year: 2024,
      photos: photoIds.slice(7, 14),
      featured: false,
    },
  ]

  for (const p of progetti) {
    await client.createOrReplace({
      _id: p.id,
      _type: 'project',
      titleIt: p.titleIt,
      titleEn: p.titleEn,
      descriptionIt: p.descriptionIt,
      descriptionEn: p.descriptionEn,
      slug: { _type: 'slug', current: p.slug },
      year: p.year,
      cover: { _type: 'reference', _ref: p.photos[0] },
      photos: p.photos.map((ref, i) => ({ _type: 'reference', _ref: ref, _key: `ph-${i}` })),
      featured: p.featured,
    })
    console.log(`  progetto ${p.slug} -> ${p.id}`)
  }
```

Il secondo progetto ha `descriptionEn: null` **di proposito**: è il caso che esercita il fallback EN→IT con marcatura `lang`, che altrimenti nessun test di questa fase toccherebbe con dati reali.

- [ ] **Step 3: Collegare i progetti alla homepage**

Nel documento `homePage`, aggiungere:

```ts
    selectedProjects: progetti
      .filter((p) => p.featured)
      .map((p, i) => ({ _type: 'reference', _ref: p.id, _key: `proj-${i}` })),
```

- [ ] **Step 4: Eseguire e verificare**

```bash
SEED_DATASET=development npx dotenv -e .env.local -- npm run seed
```

Atteso: due righe `progetto ... ->`, e il messaggio su `socialImage` mancante **non deve più comparire** — rimuoverlo dallo script.

Verificare che i riferimenti siano risolvibili:

```bash
npx sanity@latest documents query '*[_type == "project"]{slug, "nFoto": count(photos), "copertina": defined(cover)}' --dataset development
```

Atteso: due progetti, ciascuno con 7 fotografie e copertina definita.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/seedDataset.ts
git commit -m "feat: semina progetti e immagine social, prerequisiti della Fase 2"
```

---

## Task 2: Query dei progetti

**Files:**
- Modify: `lib/sanity/queries.ts`
- Test: `lib/sanity/__tests__/queries.test.ts`

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere al file esistente:

```ts
import {
  projectsIndexQuery,
  projectBySlugQuery,
  projectSlugsQuery,
  sitemapQuery,
} from '../queries'

describe('query dei progetti', () => {
  it('l indice ordina per anno decrescente, dal piu recente', () => {
    expect(projectsIndexQuery).toContain('order(year desc)')
  })

  it('l indice chiede la copertina con i metadati per riservare lo spazio', () => {
    expect(projectsIndexQuery).toContain('cover->')
    expect(projectsIndexQuery).toContain('aspectRatio')
  })

  it('il dettaglio filtra per slug come parametro, non interpolato', () => {
    expect(projectBySlugQuery).toContain('$slug')
    expect(projectBySlugQuery).not.toMatch(/slug\.current\s*==\s*"/)
  })

  it('il dettaglio scarta i riferimenti non risolvibili', () => {
    // Un riferimento rimasto appeso non deve rompere l intera pagina
    // (specifica di prodotto 12).
    expect(projectBySlugQuery).toContain('defined(@)')
  })

  it('il dettaglio conserva l ordine editoriale delle fotografie', () => {
    // photos[] e un array ordinato: la proiezione non deve riordinarlo.
    expect(projectBySlugQuery).not.toContain('order(orderRank')
  })

  it('gli slug servono a generare le pagine statiche', () => {
    expect(projectSlugsQuery).toContain('slug.current')
  })

  it('la sitemap chiede solo cio che le serve', () => {
    expect(sitemapQuery).toContain('_updatedAt')
    expect(sitemapQuery).toContain('slug.current')
  })
})
```

Il test sull'ordine merita una nota: le fotografie di un progetto seguono la sequenza scelta dall'editor nell'array `photos`, **non** l'ordinamento globale della galleria. Riordinarle per `orderRank` sarebbe un difetto silenzioso, perché il risultato sembrerebbe comunque plausibile.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/sanity/__tests__/queries.test.ts
```

Atteso: FAIL, le query non esistono.

- [ ] **Step 3: Scrivere le query**

```ts
const PROJECT_PHOTO_FIELDS = `
  _id,
  altIt, altEn,
  titleIt, titleEn,
  placeIt, placeEn,
  year,
  "url": image.asset->url,
  "aspectRatio": image.asset->metadata.dimensions.aspectRatio,
  "lqip": image.asset->metadata.lqip
`

export const projectsIndexQuery = defineQuery(`
  *[_type == "project" && defined(slug.current)] | order(year desc, titleIt asc){
    _id,
    titleIt, titleEn,
    year,
    "slug": slug.current,
    "cover": cover->{${PROJECT_PHOTO_FIELDS}}
  }
`)

export const projectBySlugQuery = defineQuery(`
  *[_type == "project" && slug.current == $slug][0]{
    _id,
    titleIt, titleEn,
    descriptionIt, descriptionEn,
    year,
    "slug": slug.current,
    "cover": cover->{${PROJECT_PHOTO_FIELDS}},
    "photos": photos[]->{${PROJECT_PHOTO_FIELDS}}[defined(@)]
  }
`)

export const projectSlugsQuery = defineQuery(`
  *[_type == "project" && defined(slug.current)].slug.current
`)

export const sitemapQuery = defineQuery(`{
  "projects": *[_type == "project" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  },
  "settingsUpdatedAt": *[_type == "siteSettings"][0]._updatedAt
}`)
```

- [ ] **Step 4: Eseguire, rigenerare i tipi, verificare**

```bash
npx vitest run lib/sanity/__tests__/queries.test.ts
npm run sanity:typegen
npm run typecheck
```

Atteso: 7 test nuovi passano; typegen riporta più query di prima; typecheck a zero.

**I tipi generati sono committati** (`lib/sanity/types.generated.ts`, `schema.json`): non sono in `.gitignore`, perché su un clone pulito la loro assenza fa fallire il build con `TS7006`. È già successo su Vercel.

- [ ] **Step 5: Commit**

```bash
git add lib/sanity/queries.ts lib/sanity/types.generated.ts schema.json lib/sanity/__tests__/queries.test.ts
git commit -m "feat: query di indice, dettaglio e sitemap dei progetti"
```

---

## Task 3: Mapping dei progetti

**Files:**
- Create: `lib/projects/toProject.ts`
- Test: `lib/projects/__tests__/toProject.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/projects/__tests__/toProject.test.ts
import { describe, it, expect } from 'vitest'
import { toProjectSummary, toProjectDetail } from '../toProject'

const foto = {
  _id: 'p1',
  altIt: 'Nebbia sul fiume',
  altEn: 'Fog over the river',
  titleIt: 'Studio 1',
  titleEn: null,
  placeIt: 'Veneto',
  placeEn: null,
  year: 2023,
  url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
  aspectRatio: 1.5,
  lqip: 'data:image/jpeg;base64,x',
}

const raw = {
  _id: 'proj1',
  titleIt: 'Nebbia',
  titleEn: 'Fog',
  descriptionIt: 'Descrizione italiana',
  descriptionEn: null,
  year: 2023,
  slug: 'nebbia',
  cover: foto,
  photos: [foto, { ...foto, _id: 'p2' }],
}

describe('toProjectSummary', () => {
  it('sceglie il titolo nella lingua della pagina', () => {
    expect(toProjectSummary(raw, 'en').title).toBe('Fog')
    expect(toProjectSummary(raw, 'it').title).toBe('Nebbia')
  })

  it('dichiara la lingua quando il titolo ricade sull italiano', () => {
    const s = toProjectSummary({ ...raw, titleEn: null }, 'en')
    expect(s.title).toBe('Nebbia')
    expect(s.titleLang).toBe('it')
  })

  it('omette l anno quando non e valorizzato', () => {
    expect(toProjectSummary({ ...raw, year: null }, 'it').year).toBeUndefined()
  })
})

describe('toProjectDetail', () => {
  it('dichiara la lingua quando la descrizione ricade sull italiano', () => {
    const d = toProjectDetail(raw, 'en')
    expect(d.description).toBe('Descrizione italiana')
    expect(d.descriptionLang).toBe('it')
  })

  it('conserva l ordine delle fotografie', () => {
    expect(toProjectDetail(raw, 'it').photos.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('sopravvive a un progetto senza fotografie', () => {
    // Lo schema ne richiede almeno una, ma un riferimento appeso puo
    // svuotare l array dopo il filtro defined(@).
    expect(toProjectDetail({ ...raw, photos: null }, 'it').photos).toEqual([])
  })

  it('restituisce null per un progetto inesistente', () => {
    expect(toProjectDetail(null, 'it')).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/projects/__tests__/toProject.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// lib/projects/toProject.ts
import { pickLocalized } from '@/lib/i18n/localize'
import { toGalleryPhoto } from '@/lib/gallery/toGalleryPhoto'
import type { Locale } from '@/lib/i18n/locales'
import type { GalleryPhoto } from '@/components/gallery/types'

type RawPhoto = Parameters<typeof toGalleryPhoto>[0]

type RawProject = {
  _id: string
  titleIt?: string | null
  titleEn?: string | null
  descriptionIt?: string | null
  descriptionEn?: string | null
  year?: number | null
  slug?: string | null
  cover?: RawPhoto | null
  photos?: RawPhoto[] | null
}

export type ProjectSummary = {
  id: string
  slug: string
  title: string
  titleLang: Locale
  year?: number
  cover: GalleryPhoto | null
}

export type ProjectDetail = ProjectSummary & {
  description: string
  descriptionLang: Locale
  photos: GalleryPhoto[]
}

export function toProjectSummary(raw: RawProject, locale: Locale): ProjectSummary {
  const title = pickLocalized({ it: raw.titleIt, en: raw.titleEn }, locale)

  return {
    id: raw._id,
    slug: raw.slug ?? '',
    title: title.value,
    titleLang: title.lang,
    year: raw.year ?? undefined,
    cover: raw.cover ? toGalleryPhoto(raw.cover, locale) : null,
  }
}

export function toProjectDetail(
  raw: RawProject | null | undefined,
  locale: Locale,
): ProjectDetail | null {
  if (!raw) return null

  const description = pickLocalized(
    { it: raw.descriptionIt, en: raw.descriptionEn },
    locale,
  )

  return {
    ...toProjectSummary(raw, locale),
    description: description.value,
    descriptionLang: description.lang,
    photos: (raw.photos ?? []).map((p) => toGalleryPhoto(p, locale)),
  }
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run lib/projects/__tests__/toProject.test.ts
```

Atteso: PASS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add lib/projects
git commit -m "feat: mapping dei progetti con marcatura della lingua di fallback"
```

---

## Task 4: Estrarre lo stato della lightbox

**Files:**
- Create: `components/lightbox/useLightbox.ts`
- Modify: `components/gallery/GalleryClient.tsx`
- Test: `components/lightbox/__tests__/useLightbox.test.tsx`

La lightbox è condivisa fra galleria e progetti (design §9). Oggi il suo stato vive dentro `GalleryClient`, insieme alla paginazione: le pagine di progetto ne userebbero metà. L'estrazione avviene ora, prima che esista un secondo chiamante, così non si duplica.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/lightbox/__tests__/useLightbox.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLightbox } from '../useLightbox'

function Prova() {
  const { openIndex, open, close, navigate } = useLightbox()

  return (
    <div>
      <button onClick={(e) => open(2, e.currentTarget)}>apri</button>
      <button onClick={() => navigate(3)}>avanti</button>
      <button onClick={close}>chiudi</button>
      <output>{openIndex === null ? 'chiusa' : String(openIndex)}</output>
    </div>
  )
}

describe('useLightbox', () => {
  it('parte chiusa', () => {
    render(<Prova />)
    expect(screen.getByRole('status')).toHaveTextContent('chiusa')
  })

  it('apre sull indice richiesto', async () => {
    render(<Prova />)
    await userEvent.click(screen.getByRole('button', { name: 'apri' }))
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('naviga fra le fotografie', async () => {
    render(<Prova />)
    await userEvent.click(screen.getByRole('button', { name: 'apri' }))
    await userEvent.click(screen.getByRole('button', { name: 'avanti' }))
    expect(screen.getByRole('status')).toHaveTextContent('3')
  })

  it('restituisce il focus all elemento di origine alla chiusura', async () => {
    render(<Prova />)
    const apri = screen.getByRole('button', { name: 'apri' })

    await userEvent.click(apri)
    await userEvent.click(screen.getByRole('button', { name: 'chiudi' }))

    // Safari non sposta il focus su un button al clic, quindi l origine va
    // passata esplicitamente e non dedotta da document.activeElement.
    expect(apri).toHaveFocus()
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run components/lightbox/__tests__/useLightbox.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere l'hook**

```ts
// components/lightbox/useLightbox.ts
'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Stato della lightbox, condiviso fra galleria e pagine di progetto.
 *
 * L elemento di origine viene passato esplicitamente a `open` invece di essere
 * dedotto da `document.activeElement`: Safari non sposta il focus su un button
 * quando lo si clicca, quindi l origine dedotta sarebbe `<body>` e alla
 * chiusura il focus non tornerebbe alla fotografia.
 */
export function useLightbox() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const originRef = useRef<HTMLElement | null>(null)

  function open(index: number, origin: HTMLElement | null) {
    originRef.current = origin
    setOpenIndex(index)
  }

  function close() {
    setOpenIndex(null)
  }

  // Il focus va restituito DOPO lo smontaggio: dentro `close` React non ha
  // ancora rimosso la dialog, e chiudendola il browser sposterebbe di nuovo
  // il focus subito dopo.
  useEffect(() => {
    if (openIndex === null) originRef.current?.focus()
  }, [openIndex])

  return { openIndex, open, close, navigate: setOpenIndex }
}
```

- [ ] **Step 4: Riscrivere `GalleryClient` sull'hook**

Sostituire lo stato locale con:

```tsx
  const { openIndex, open, close, navigate } = useLightbox()
```

e passare `onOpen={open}` a `PhotoGrid`, `onClose={close}` e `onNavigate={navigate}` a `Lightbox`. Rimuovere `originRef`, la funzione `open`/`close` locali e l'effect di ripristino del focus, ora nell'hook.

`PhotoTile` chiama già `event.currentTarget.focus()` prima di `onOpen`: aggiornare la sua firma perché passi l'elemento, `onOpen(index, event.currentTarget)`, così l'origine non dipende più dal focus riuscito.

- [ ] **Step 5: Eseguire l'intera suite**

```bash
npm test
```

Atteso: tutti i test passano, compresi quelli esistenti di `PhotoGrid`.

- [ ] **Step 6: Commit**

```bash
git add components/lightbox components/gallery
git commit -m "refactor: estrae lo stato della lightbox in un hook condiviso"
```

---

## Task 5: Indice dei progetti

**Files:**
- Create: `views/ProjectsView.tsx` + `.module.css`
- Test: `views/__tests__/ProjectsView.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

`ProjectsView` è un Server Component async: il test copre il componente di presentazione sincrono che rende la lista, non la vista che fa la query.

```tsx
// views/__tests__/ProjectsView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectsList } from '../ProjectsView'

const progetti = [
  {
    id: 'a',
    slug: 'nebbia',
    title: 'Nebbia',
    titleLang: 'it' as const,
    year: 2023,
    cover: {
      id: 'p1', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg',
      lqip: null, alt: 'Copertina', altLang: 'it' as const,
    },
  },
  { id: 'b', slug: 'citta', title: 'City', titleLang: 'en' as const, cover: null },
]

describe('ProjectsList', () => {
  it('rende un collegamento per progetto, con lo slug localizzato', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByRole('link', { name: /Nebbia/ })).toHaveAttribute('href', '/it/progetti/nebbia')
  })

  it('usa il segmento inglese in inglese', () => {
    render(<ProjectsList projects={progetti} locale="en" />)
    expect(screen.getByRole('link', { name: /Nebbia/ })).toHaveAttribute('href', '/en/projects/nebbia')
  })

  it('mostra l anno solo quando c e', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.queryByText('undefined')).toBeNull()
  })

  it('marca la lingua del titolo quando differisce dalla pagina', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByText('City')).toHaveAttribute('lang', 'en')
  })

  it('regge un progetto senza copertina senza rompersi', () => {
    render(<ProjectsList projects={progetti} locale="it" />)
    expect(screen.getByRole('link', { name: /City/ })).toBeInTheDocument()
  })
})
```

L'ultimo test copre la specifica di prodotto §12: un riferimento non più disponibile viene omesso senza rompere la pagina. La copertina è obbligatoria a schema, ma un riferimento appeso la può azzerare.

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run views/__tests__/ProjectsView.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere vista e lista**

```tsx
// views/ProjectsView.tsx
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import { sanityFetch } from '@/lib/sanity/fetch'
import { projectsIndexQuery } from '@/lib/sanity/queries'
import { toProjectSummary, type ProjectSummary } from '@/lib/projects/toProject'
import { SanityImage } from '@/components/media/SanityImage'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './ProjectsView.module.css'

export function ProjectsList({
  projects,
  locale,
}: {
  projects: ProjectSummary[]
  locale: Locale
}) {
  return (
    <ul className={styles.list}>
      {projects.map((project, i) => (
        <li key={project.id} className={styles.item} style={{ '--i': String(i) } as React.CSSProperties}>
          <Link href={pathFor(locale, { key: 'project', slug: project.slug })} className={styles.link}>
            {project.cover ? (
              <SanityImage
                photo={{
                  url: project.cover.url,
                  aspectRatio: project.cover.ar,
                  lqip: project.cover.lqip,
                  alt: project.cover.alt,
                  altLang: project.cover.altLang,
                }}
                sizes="(max-width: 767px) 100vw, 50vw"
                locale={locale}
                className={styles.cover}
              />
            ) : null}

            <span className={styles.meta}>
              <span
                className={styles.title}
                lang={project.titleLang === locale ? undefined : project.titleLang}
              >
                {project.title}
              </span>
              {project.year ? <span className={styles.year}>{project.year}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export async function ProjectsView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const raw = await sanityFetch({ query: projectsIndexQuery, tags: ['projects-index'] })
  const projects = (raw ?? []).map((p) => toProjectSummary(p, locale))

  return (
    <div className={styles.projects}>
      <h1 className={styles.heading}>{dict.navProjects}</h1>
      {projects.length === 0 ? (
        <EmptyState message={dict.emptyProjects} />
      ) : (
        <ProjectsList projects={projects} locale={locale} />
      )}
    </div>
  )
}
```

Aggiungere `emptyProjects` a entrambi i dizionari: `'Nessun progetto pubblicato al momento.'` e `'No projects published yet.'`

```css
/* views/ProjectsView.module.css */
.projects {
  padding: var(--space-6) 0 0;
}

.heading {
  max-width: var(--content-max);
  margin: 0 auto var(--space-6);
  padding: 0 var(--space-5);
}

/* Copertine ampie, una accanto all altra su schermi larghi: la specifica di
   prodotto 8.4 chiede copertine ampie, non una griglia fitta. */
.list {
  list-style: none;
  padding: 0 var(--space-5);
  margin: 0 auto;
  max-width: var(--content-max);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(28rem, 100%), 1fr));
  gap: var(--space-6) var(--space-4);
}

.item {
  animation: reveal var(--duration-reveal) var(--ease-out) both;
  animation-delay: calc(min(var(--i, 0), 6) * 70ms);
}

.link {
  display: grid;
  gap: var(--space-3);
  text-decoration: none;
}

.cover {
  overflow: hidden;
}

.link:hover .cover img,
.link:focus-visible .cover img {
  transform: scale(1.035);
  filter: brightness(1.06);
}

.cover img {
  transition: transform var(--duration-reveal) var(--ease-out),
    filter var(--duration-slow) var(--ease);
}

.meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  letter-spacing: var(--tracking-display);
}

.year {
  font-family: var(--font-sans);
  font-size: var(--size-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  color: var(--fg-muted);
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run views/__tests__/ProjectsView.test.tsx
```

Atteso: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
git add views/ProjectsView.tsx views/ProjectsView.module.css views/__tests__ lib/i18n/dictionaries
git commit -m "feat: indice dei progetti con copertine ampie"
```

---

## Task 6: Pagina di progetto

**Files:**
- Create: `views/ProjectView.tsx` + `.module.css`, `components/projects/ProjectSequence.tsx` + `.module.css`
- Test: `components/projects/__tests__/ProjectSequence.test.tsx`

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// components/projects/__tests__/ProjectSequence.test.tsx
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectSequence } from '../ProjectSequence'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const foto = (id: string, ar = 1.5) => ({
  id, ar, url: `https://cdn.sanity.io/images/p/d/${id}-3000x2000.jpg`,
  lqip: null, alt: `Alt ${id}`, altLang: 'it' as const,
})

const photos = [foto('a'), foto('b', 0.75), foto('c')]

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

describe('ProjectSequence', () => {
  it('rende ogni fotografia della sequenza', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  it('rende ogni fotografia come pulsante, apribile da tastiera', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('apre la lightbox sulla fotografia scelta', async () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    await userEvent.click(screen.getAllByRole('button')[1])

    // La lightbox e la stessa della galleria: il nome accessibile porta la
    // posizione, quindi verifica anche che l indice sia quello giusto.
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/2 \/ 3/)
  })

  it('conserva l ordine editoriale della sequenza', () => {
    render(<ProjectSequence photos={photos} locale="it" dict={dict} />)
    const alt = screen.getAllByRole('img').map((i) => i.getAttribute('alt'))
    expect(alt).toEqual(['Alt a', 'Alt b', 'Alt c'])
  })

  it('non rende nulla per una sequenza vuota', () => {
    const { container } = render(<ProjectSequence photos={[]} locale="it" dict={dict} />)
    expect(container.querySelector('img')).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run components/projects/__tests__/ProjectSequence.test.tsx
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Scrivere `ProjectSequence`**

```tsx
// components/projects/ProjectSequence.tsx
'use client'

import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GalleryPhoto } from '@/components/gallery/types'
import { SanityImage } from '@/components/media/SanityImage'
import { Lightbox } from '@/components/lightbox/Lightbox'
import { useLightbox } from '@/components/lightbox/useLightbox'
import styles from './ProjectSequence.module.css'

export function ProjectSequence({
  photos,
  locale,
  dict,
}: {
  photos: GalleryPhoto[]
  locale: Locale
  dict: Dictionary
}) {
  const { openIndex, open, close, navigate } = useLightbox()

  if (photos.length === 0) return null

  return (
    <>
      <div className={styles.sequence}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className={styles.item}
            style={{ '--ar': String(photo.ar) } as React.CSSProperties}
            onClick={(event) => {
              // Safari non mette a fuoco un button al clic: l origine va
              // passata esplicitamente, altrimenti alla chiusura della
              // lightbox il focus finisce su body.
              event.currentTarget.focus()
              open(index, event.currentTarget)
            }}
          >
            <SanityImage
              photo={{
                url: photo.url,
                aspectRatio: photo.ar,
                lqip: photo.lqip,
                alt: photo.alt,
                altLang: photo.altLang,
              }}
              sizes="(max-width: 767px) 100vw, min(100vw, 76rem)"
              locale={locale}
            />
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          locale={locale}
          dict={dict}
          onClose={close}
          onNavigate={navigate}
        />
      ) : null}
    </>
  )
}
```

```css
/* components/projects/ProjectSequence.module.css */
/* Sequenza verticale con spaziatura generosa (specifica di prodotto 8.4):
   una fotografia per volta, non una griglia. */
.sequence {
  display: grid;
  gap: var(--space-7);
  max-width: 76rem;
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.item {
  display: block;
  padding: 0;
  overflow: hidden;
  min-width: 0;
}

.item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.item img {
  transition: transform var(--duration-reveal) var(--ease-out);
}

.item:hover img,
.item:focus-visible img {
  transform: scale(1.02);
}

@media (max-width: 767px) {
  .sequence {
    gap: var(--space-5);
    padding: 0 var(--space-4);
  }
}
```

- [ ] **Step 4: Scrivere `ProjectView`**

```tsx
// views/ProjectView.tsx
import { notFound } from 'next/navigation'
import type { Locale } from '@/lib/i18n/locales'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sanityFetch } from '@/lib/sanity/fetch'
import { projectBySlugQuery } from '@/lib/sanity/queries'
import { toProjectDetail } from '@/lib/projects/toProject'
import { ProjectSequence } from '@/components/projects/ProjectSequence'
import styles from './ProjectView.module.css'

export async function ProjectView({ locale, slug }: { locale: Locale; slug: string }) {
  const dict = getDictionary(locale)
  const raw = await sanityFetch({
    query: projectBySlugQuery,
    params: { slug },
    tags: [`project:${slug}`],
  })

  const project = toProjectDetail(raw, locale)

  // Progetti inesistenti, rimossi o non pubblicati: 404 localizzata
  // (specifica di prodotto 6).
  if (!project) notFound()

  return (
    <article className={styles.project}>
      <header className={styles.header}>
        <h1
          className={styles.title}
          lang={project.titleLang === locale ? undefined : project.titleLang}
        >
          {project.title}
        </h1>
        {project.year ? <p className={styles.year}>{project.year}</p> : null}
        {project.description ? (
          <p
            className={styles.description}
            lang={project.descriptionLang === locale ? undefined : project.descriptionLang}
          >
            {project.description}
          </p>
        ) : null}
      </header>

      <ProjectSequence photos={project.photos} locale={locale} dict={dict} />
    </article>
  )
}
```

```css
/* views/ProjectView.module.css */
.project {
  padding: var(--space-6) 0 0;
}

.header {
  max-width: 62ch;
  margin: 0 auto var(--space-7);
  padding: 0 var(--space-5);
  display: grid;
  gap: var(--space-3);
  animation: reveal var(--duration-slow) var(--ease-out) both;
}

.year {
  font-family: var(--font-sans);
  font-size: var(--size-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  color: var(--fg-muted);
}

.description {
  font-size: 1.0625rem;
  color: var(--fg-muted);
}

@media (max-width: 767px) {
  .header {
    padding: 0 var(--space-4);
    margin-bottom: var(--space-6);
  }
}
```

- [ ] **Step 5: Eseguire e verificare che passi**

```bash
npx vitest run components/projects
npm run typecheck
```

Atteso: PASS, 5 test; typecheck a zero.

- [ ] **Step 6: Commit**

```bash
git add views/ProjectView.tsx views/ProjectView.module.css components/projects
git commit -m "feat: pagina di progetto con sequenza verticale e lightbox condivisa"
```

---

## Task 7: Collegare le rotte dei progetti

**Files:**
- Modify: `app/[locale]/[[...segments]]/page.tsx`, `components/layout/Header.tsx`, `components/layout/MobileMenu.tsx`
- Test: `components/layout/__tests__/Header.test.tsx`

- [ ] **Step 1: Aggiornare il test dell'header**

Il test attuale asserisce che Progetti **non** sia linkato. Sostituirlo:

```tsx
  it('linka Fotografie, Progetti e About', () => {
    render(<Header locale="it" siteName="Andrea Gallato" />)
    expect(screen.getByRole('link', { name: 'Fotografie' })).toHaveAttribute('href', '/it/fotografie')
    expect(screen.getByRole('link', { name: 'Progetti' })).toHaveAttribute('href', '/it/progetti')
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/it/about')
  })
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run components/layout/__tests__/Header.test.tsx
```

Atteso: FAIL, il collegamento a Progetti non esiste.

- [ ] **Step 3: Aggiungere la voce in entrambe le versioni dell'header**

In `Header.tsx`, fra Fotografie e About:

```tsx
        <Link href={pathFor(locale, { key: 'projects' })} className={`${styles.link} label`}>
          {dict.navProjects}
        </Link>
```

In `MobileMenu.tsx`, con la stessa struttura degli altri `navLink`.

- [ ] **Step 4: Collegare le rotte nella catch-all**

Aggiungere al `switch`:

```tsx
    case 'projects':
      return <ProjectsView locale={locale} />

    case 'project':
      return <ProjectView locale={locale} slug={route.slug} />
```

e gli import corrispondenti.

- [ ] **Step 5: Generare staticamente indice e pagine di progetto**

Sostituire `generateStaticParams`:

```tsx
export async function generateStaticParams() {
  const slugs = await sanityFetch({ query: projectSlugsQuery, tags: ['projects-index'] })

  return LOCALES.flatMap((locale) => [
    { locale, segments: [] as string[] },
    { locale, segments: [...ROUTES.gallery[locale]] },
    { locale, segments: [...ROUTES.projects[locale]] },
    { locale, segments: [...ROUTES.about[locale]] },
    ...(slugs ?? []).map((slug) => ({
      locale,
      segments: [...ROUTES.projects[locale], slug],
    })),
  ])
}
```

`dynamicParams` resta al default `true`: un progetto pubblicato dopo il build viene generato su richiesta invece di dare 404 fino al deploy successivo.

- [ ] **Step 6: Verificare a mano**

```bash
npm run dev
```

| URL | Atteso |
|---|---|
| `/it/progetti` | 200, due progetti |
| `/en/projects` | 200 |
| `/it/progetti/nebbia` | 200, sette fotografie in sequenza |
| `/en/projects/nebbia` | 200 |
| `/it/progetti/inesistente` | 404 |
| `/it/projects` | 404 |

Verificare anche che la descrizione del progetto `citta` in inglese ricada sull'italiano e porti `lang="it"`.

- [ ] **Step 7: Eseguire la suite e committare**

```bash
npm test && npm run typecheck && npm run build
git add app components/layout
git commit -m "feat: collega indice e pagine di progetto, generate staticamente"
```

Nel build devono comparire `/it/progetti`, `/en/projects` e le pagine dei due progetti come SSG.

---

## Task 8: Metadati completi

**Files:**
- Create: `lib/seo/metadata.ts`
- Modify: `lib/sanity/imageUrl.ts`, `app/[locale]/[[...segments]]/page.tsx`
- Test: `lib/seo/__tests__/metadata.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/seo/__tests__/metadata.test.ts
import { describe, it, expect } from 'vitest'
import { buildPageMetadata } from '../metadata'

const base = {
  siteUrl: 'https://esempio.it',
  siteName: 'Andrea Gallato',
  socialImageUrl: 'https://cdn.sanity.io/images/p/d/s-2000x1000.jpg',
}

describe('buildPageMetadata', () => {
  it('dichiara il canonical sul percorso pubblico localizzato', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'gallery' }, title: 'Fotografie' })
    expect(m.alternates?.canonical).toBe('https://esempio.it/it/fotografie')
  })

  it('dichiara entrambe le lingue in hreflang, con i segmenti tradotti', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'gallery' }, title: 'Fotografie' })
    expect(m.alternates?.languages).toEqual({
      it: 'https://esempio.it/it/fotografie',
      en: 'https://esempio.it/en/photographs',
    })
  })

  it('conserva lo slug di progetto in entrambe le lingue', () => {
    const m = buildPageMetadata({
      ...base, locale: 'en', route: { key: 'project', slug: 'nebbia' }, title: 'Fog',
    })
    expect(m.alternates?.languages).toEqual({
      it: 'https://esempio.it/it/progetti/nebbia',
      en: 'https://esempio.it/en/projects/nebbia',
    })
  })

  it('fissa il formato dell immagine social invece di negoziarlo', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'Andrea Gallato' })
    const url = String((m.openGraph?.images as { url: string }[])[0].url)

    // auto=format dipende dall header Accept, che gli scraper social non
    // mandano in modo affidabile: l anteprima arriverebbe in un formato che
    // non sanno rendere, o non arriverebbe affatto.
    expect(url).toContain('fm=jpg')
    expect(url).not.toContain('auto=format')
  })

  it('dichiara la lingua del documento in Open Graph', () => {
    const it = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'x' })
    const en = buildPageMetadata({ ...base, locale: 'en', route: { key: 'home' }, title: 'x' })
    expect(it.openGraph?.locale).toBe('it_IT')
    expect(en.openGraph?.locale).toBe('en_US')
  })

  it('omette l immagine social quando non e configurata', () => {
    const m = buildPageMetadata({
      ...base, socialImageUrl: null, locale: 'it', route: { key: 'home' }, title: 'x',
    })
    expect(m.openGraph?.images).toBeUndefined()
  })

  it('usa la descrizione solo se valorizzata', () => {
    const m = buildPageMetadata({ ...base, locale: 'it', route: { key: 'home' }, title: 'x', description: '  ' })
    expect(m.description).toBeUndefined()
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run lib/seo/__tests__/metadata.test.ts
```

Atteso: FAIL, import non risolto.

- [ ] **Step 3: Aggiungere il costruttore di URL per i crawler**

In `lib/sanity/imageUrl.ts`:

```ts
/**
 * URL per gli scraper social. Il formato e fissato invece che negoziato:
 * `auto=format` dipende dall header Accept, che i crawler non mandano in modo
 * affidabile, e l anteprima arriverebbe in un formato che non sanno rendere.
 * Le dimensioni sono quelle attese da Open Graph.
 */
export function buildSocialImageUrl(src: string): string {
  const url = new URL(src)
  url.searchParams.set('w', '1200')
  url.searchParams.set('h', '630')
  url.searchParams.set('fit', 'crop')
  url.searchParams.set('fm', 'jpg')
  url.searchParams.set('q', '80')
  return url.toString()
}
```

- [ ] **Step 4: Scrivere `buildPageMetadata`**

```ts
// lib/seo/metadata.ts
import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/locales'
import { LOCALES } from '@/lib/i18n/locales'
import { pathFor, type Resolved } from '@/lib/i18n/routes'
import { buildSocialImageUrl } from '@/lib/sanity/imageUrl'

const OG_LOCALE: Record<Locale, string> = { it: 'it_IT', en: 'en_US' }

export function buildPageMetadata({
  siteUrl,
  siteName,
  socialImageUrl,
  locale,
  route,
  title,
  description,
}: {
  siteUrl: string
  siteName: string
  socialImageUrl?: string | null
  locale: Locale
  route: Resolved
  title: string
  description?: string | null
}): Metadata {
  const absolute = (l: Locale) => `${siteUrl}${pathFor(l, route)}`
  const cleanDescription = description?.trim() || undefined

  const images = socialImageUrl
    ? [{ url: buildSocialImageUrl(socialImageUrl), width: 1200, height: 630 }]
    : undefined

  return {
    title,
    description: cleanDescription,
    alternates: {
      canonical: absolute(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, absolute(l)])) as Record<Locale, string>,
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description: cleanDescription,
      url: absolute(locale),
      locale: OG_LOCALE[locale],
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description: cleanDescription,
    },
  }
}
```

- [ ] **Step 5: Usarlo nella catch-all**

Aggiungere `generateMetadata` in `app/[locale]/[[...segments]]/page.tsx`, che risolve la rotta come fa `Page` e compone titolo e descrizione secondo il tipo di pagina: per un progetto il titolo è quello del progetto, altrove quello di `siteSettings`.

Il layout mantiene il proprio `generateMetadata` con il solo `metadataBase` e i valori di ripiego: i metadati di pagina lo sovrascrivono, ma se una rotta non ne fornisce il titolo non sparisce.

- [ ] **Step 6: Eseguire, verificare, committare**

```bash
npx vitest run lib/seo && npm run typecheck && npm run build
```

Con `npm run start`, verificare su una pagina di progetto:

```bash
curl -s http://localhost:3000/it/progetti/nebbia | grep -oE '<link rel="canonical"[^>]*>|hreflang="[a-z]{2}"|<meta property="og:image"[^>]*>'
```

Atteso: canonical su `/it/progetti/nebbia`, due `hreflang`, e un'immagine Open Graph con `fm=jpg`.

```bash
git add lib/seo lib/sanity/imageUrl.ts app
git commit -m "feat: canonical, hreflang e Open Graph con formato fissato per i crawler"
```

---

## Task 9: Sitemap e robots

**Files:**
- Create: `app/sitemap.ts`, `app/robots.ts`, `lib/seo/sitemapEntries.ts`
- Test: `lib/seo/__tests__/sitemapEntries.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/seo/__tests__/sitemapEntries.test.ts
import { describe, it, expect } from 'vitest'
import { buildSitemapEntries } from '../sitemapEntries'

const dati = {
  siteUrl: 'https://esempio.it',
  projects: [{ slug: 'nebbia', _updatedAt: '2026-08-01T10:00:00Z' }],
  fallbackDate: '2026-08-05T10:00:00Z',
}

describe('buildSitemapEntries', () => {
  it('elenca ogni pagina pubblica in entrambe le lingue', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)

    expect(url).toContain('https://esempio.it/it')
    expect(url).toContain('https://esempio.it/en')
    expect(url).toContain('https://esempio.it/it/fotografie')
    expect(url).toContain('https://esempio.it/en/photographs')
    expect(url).toContain('https://esempio.it/it/progetti')
    expect(url).toContain('https://esempio.it/en/projects')
    expect(url).toContain('https://esempio.it/it/about')
    expect(url).toContain('https://esempio.it/en/about')
  })

  it('include le pagine di progetto in entrambe le lingue', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)
    expect(url).toContain('https://esempio.it/it/progetti/nebbia')
    expect(url).toContain('https://esempio.it/en/projects/nebbia')
  })

  it('dichiara le lingue alternative di ogni voce', () => {
    const home = buildSitemapEntries(dati).find((e) => e.url === 'https://esempio.it/it')
    expect(home?.alternates?.languages).toEqual({
      it: 'https://esempio.it/it',
      en: 'https://esempio.it/en',
    })
  })

  it('usa la data di modifica del progetto, non quella di ripiego', () => {
    const p = buildSitemapEntries(dati).find((e) => e.url.endsWith('/progetti/nebbia'))
    expect(p?.lastModified).toEqual(new Date('2026-08-01T10:00:00Z'))
  })

  it('non produce mai URL doppie', () => {
    const url = buildSitemapEntries(dati).map((e) => e.url)
    expect(new Set(url).size).toBe(url.length)
  })

  it('regge l assenza di progetti', () => {
    expect(buildSitemapEntries({ ...dati, projects: [] }).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Eseguire, implementare, verificare**

`buildSitemapEntries` è una funzione pura che compone le voci da `ROUTES` e dall'elenco dei progetti. `app/sitemap.ts` si limita a fare la query e chiamarla; `app/robots.ts` esclude `/studio` e `/api` e indica la sitemap.

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/studio', '/api/'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
```

- [ ] **Step 3: Verificare l'output reale**

```bash
npm run build && npm run start
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/robots.txt
```

Atteso: la sitemap elenca 10 URL (4 pagine × 2 lingue più 2 pagine di progetto), robots esclude `/studio` e `/api/`.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts app/robots.ts lib/seo
git commit -m "feat: sitemap con lingue alternative e regole robots"
```

---

## Task 10: Mappa dei tag di revalidation

**Files:**
- Create: `lib/revalidation/tags.ts`
- Test: `lib/revalidation/__tests__/tags.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/revalidation/__tests__/tags.test.ts
import { describe, it, expect } from 'vitest'
import { directTagsFor } from '../tags'

describe('directTagsFor', () => {
  it('una fotografia invalida la galleria', () => {
    expect(directTagsFor({ _type: 'photo', _id: 'p1', operation: 'update' })).toContain('gallery')
  })

  it('un progetto invalida se stesso e l indice', () => {
    const t = directTagsFor({ _type: 'project', _id: 'x', slug: 'nebbia', operation: 'update' })
    expect(t).toContain('project:nebbia')
    expect(t).toContain('projects-index')
  })

  it('un cambio di slug invalida vecchio e nuovo percorso', () => {
    // Senza il vecchio tag la pagina al vecchio indirizzo resterebbe servita
    // dalla cache a tempo indeterminato.
    const t = directTagsFor({
      _type: 'project', _id: 'x', slug: 'nebbia-2024', previousSlug: 'nebbia', operation: 'update',
    })
    expect(t).toContain('project:nebbia-2024')
    expect(t).toContain('project:nebbia')
  })

  it('la homepage invalida se stessa', () => {
    expect(directTagsFor({ _type: 'homePage', _id: 'homePage', operation: 'update' })).toContain('home')
  })

  it('About invalida se stessa', () => {
    expect(directTagsFor({ _type: 'aboutPage', _id: 'aboutPage', operation: 'update' })).toContain('about')
  })

  it('le impostazioni invalidano tutto, perche compaiono su ogni pagina', () => {
    const t = directTagsFor({ _type: 'siteSettings', _id: 'siteSettings', operation: 'update' })
    for (const atteso of ['settings', 'home', 'gallery', 'projects-index', 'about', 'sitemap']) {
      expect(t).toContain(atteso)
    }
  })

  it('include sempre la sitemap per cio che vi compare', () => {
    expect(directTagsFor({ _type: 'project', _id: 'x', slug: 's', operation: 'create' })).toContain('sitemap')
  })

  it('e idempotente: nessun tag ripetuto', () => {
    const t = directTagsFor({ _type: 'siteSettings', _id: 'siteSettings', operation: 'update' })
    expect(new Set(t).size).toBe(t.length)
  })

  it('vale per creazione, aggiornamento ed eliminazione allo stesso modo', () => {
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(directTagsFor({ _type: 'project', _id: 'x', slug: 's', operation })).toContain('projects-index')
    }
  })

  it('ignora i tipi sconosciuti senza lanciare', () => {
    expect(directTagsFor({ _type: 'qualcosa', _id: 'x', operation: 'update' })).toEqual([])
  })
})
```

- [ ] **Step 2: Eseguire, implementare, verificare**

`directTagsFor` è **pura**: nessuna chiamata di rete, deterministica, restituisce un insieme senza ripetizioni. È la proprietà che la rende testabile per intero.

- [ ] **Step 3: Commit**

```bash
git add lib/revalidation
git commit -m "feat: mappa pura dei tag di revalidation"
```

---

## Task 11: Route handler del webhook

**Files:**
- Create: `app/api/revalidate/route.ts`, `lib/revalidation/dependents.ts`
- Test: `app/api/revalidate/__tests__/route.test.ts`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// app/api/revalidate/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag }))

const isValidSignature = vi.fn()
vi.mock('@sanity/webhook', () => ({
  isValidSignature: (...a: unknown[]) => isValidSignature(...a),
  SIGNATURE_HEADER_NAME: 'sanity-webhook-signature',
}))

vi.mock('@/lib/revalidation/dependents', () => ({
  resolveDependentTags: vi.fn(async () => []),
}))

const { POST } = await import('../route')

function richiesta(body: unknown, firma?: string) {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: firma ? { 'sanity-webhook-signature': firma } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    isValidSignature.mockReset()
    process.env.SANITY_REVALIDATE_SECRET = 'segreto'
  })

  it('rifiuta una richiesta senza firma', async () => {
    const res = await POST(richiesta({ _type: 'photo' }))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rifiuta una firma non valida', async () => {
    isValidSignature.mockResolvedValue(false)
    const res = await POST(richiesta({ _type: 'photo' }, 'sbagliata'))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('attende la verifica, che e asincrona', async () => {
    // isValidSignature restituisce una Promise da @sanity/webhook v4: senza
    // await la condizione e sempre falsa e QUALUNQUE richiesta passa.
    isValidSignature.mockResolvedValue(false)
    await POST(richiesta({ _type: 'photo' }, 'sbagliata'))
    expect(isValidSignature).toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('non espone dettagli nel rifiuto', async () => {
    isValidSignature.mockResolvedValue(false)
    const res = await POST(richiesta({ _type: 'photo' }, 'x'))
    expect(await res.text()).toBe('')
  })

  it('applica i tag con firma valida', async () => {
    isValidSignature.mockResolvedValue(true)
    const res = await POST(richiesta({ _type: 'project', _id: 'x', slug: 'nebbia' }, 'ok'))

    expect(res.status).toBe(200)
    const applicati = revalidateTag.mock.calls.map((c) => c[0])
    expect(applicati).toContain('project:nebbia')
    expect(applicati).toContain('projects-index')
  })

  it('chiede scadenza immediata, non il comportamento predefinito', async () => {
    isValidSignature.mockResolvedValue(true)
    await POST(richiesta({ _type: 'homePage', _id: 'homePage' }, 'ok'))

    // Su Next 16 la forma a un argomento e deprecata e il default non scade
    // subito: senza il secondo argomento la pubblicazione non si vedrebbe.
    expect(revalidateTag).toHaveBeenCalledWith('home', { expire: 0 })
  })

  it('e idempotente: due chiamate identiche non fanno danni', async () => {
    isValidSignature.mockResolvedValue(true)
    const corpo = { _type: 'aboutPage', _id: 'aboutPage' }
    const a = await POST(richiesta(corpo, 'ok'))
    const b = await POST(richiesta(corpo, 'ok'))
    expect([a.status, b.status]).toEqual([200, 200])
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run app/api/revalidate/__tests__/route.test.ts
```

Atteso: FAIL, il route handler non esiste.

- [ ] **Step 3: Scrivere il route handler**

```ts
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import { directTagsFor, type WebhookPayload } from '@/lib/revalidation/tags'
import { resolveDependentTags } from '@/lib/revalidation/dependents'

export async function POST(request: Request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const signature = request.headers.get(SIGNATURE_HEADER_NAME)

  // Il corpo di una Request Web si consuma UNA volta sola: si legge il testo
  // grezzo per la firma e poi lo si analizza, mai request.json() dopo.
  const body = await request.text()

  // `isValidSignature` e asincrona da @sanity/webhook v4: senza await la
  // Promise e sempre truthy e ogni richiesta verrebbe accettata.
  if (!secret || !signature || !(await isValidSignature(body, signature, secret))) {
    return new Response(null, { status: 401 })
  }

  const payload = JSON.parse(body) as WebhookPayload

  const tags = new Set([
    ...directTagsFor(payload),
    ...(await resolveDependentTags(payload)),
  ])

  // `{ expire: 0 }` e la forma raccomandata per i webhook: su Next 16 quella a
  // un solo argomento e deprecata e non scade immediatamente.
  for (const tag of tags) revalidateTag(tag, { expire: 0 })

  return Response.json({ revalidated: [...tags] })
}
```

- [ ] **Step 4: Scrivere la risoluzione delle dipendenze inverse**

```ts
// lib/revalidation/dependents.ts
import { publicClient } from '@/lib/sanity/client'
import type { WebhookPayload } from './tags'

/**
 * Dipendenze inverse: quali pagine mostrano il documento cambiato.
 *
 * Le sotto-query sono VIETATE nelle proiezioni dei webhook Sanity, quindi
 * questa informazione non puo arrivare nel payload e va chiesta qui. E il
 * motivo per cui `directTagsFor` resta pura e questa funzione e separata.
 */
export async function resolveDependentTags(payload: WebhookPayload): Promise<string[]> {
  if (payload._type !== 'photo') return []

  const referenti = await publicClient.fetch<{ slug: string | null; type: string }[]>(
    `*[_type in ["project", "homePage"] && references($id)]{
      "slug": slug.current,
      "type": _type
    }`,
    { id: payload._id },
  )

  const tags = new Set<string>()
  for (const r of referenti ?? []) {
    if (r.type === 'homePage') tags.add('home')
    if (r.type === 'project' && r.slug) {
      tags.add(`project:${r.slug}`)
      tags.add('projects-index')
    }
  }

  return [...tags]
}
```

**Non si tagga per fotografia sulle pagine di progetto.** Next limita a 128 il numero di tag per fetch: un progetto con più di ~125 scatti supererebbe il limite con comportamento non definito, e per un portfolio fotografico non è uno scenario esotico.

- [ ] **Step 5: Eseguire e verificare che passi**

```bash
npx vitest run app/api/revalidate && npm run typecheck && npm run build
```

Atteso: PASS, 8 test.

- [ ] **Step 6: Commit**

```bash
git add app/api/revalidate lib/revalidation
git commit -m "feat: webhook di revalidation con firma verificata e dipendenze inverse"
```

---

## Task 12: Configurare il webhook e verificarlo in produzione

Questo task **non produce codice**: produce la prova che la catena editoriale funziona. Richiede il deploy, perché Sanity non può raggiungere `localhost`.

- [ ] **Step 1: Generare il segreto e configurarlo su Vercel**

```bash
openssl rand -base64 32
```

Aggiungere il valore come `SANITY_REVALIDATE_SECRET` nelle Environment Variables del progetto Vercel, per tutti gli ambienti. **Va incollato dall'utente nella dashboard**: è un segreto e non deve passare da qui.

Ripubblicare perché la variabile sia disponibile.

- [ ] **Step 2: Verificare i flag della CLI prima di usarli**

```bash
npx sanity@latest hook --help
```

Leggere i flag realmente disponibili in questa versione invece di assumerli. Se la creazione da CLI non è supportata, configurare il webhook da <https://www.sanity.io/manage> → API → Webhooks.

- [ ] **Step 3: Creare il webhook**

Impostazioni:

- **URL**: `https://<dominio-vercel>/api/revalidate`
- **Dataset**: quello che il sito legge — oggi `development`
- **Trigger**: create, update, delete
- **Filter**: `_type in ["photo", "project", "homePage", "aboutPage", "siteSettings"]`
- **Projection**:

```groq
{
  _id,
  _type,
  _rev,
  "slug": slug.current,
  "previousSlug": before().slug.current,
  "operation": delta::operation()
}
```

- **Secret**: quello generato allo Step 1
- **HTTP method**: POST, **API version**: `v2021-03-25` o successiva

**Nella proiezione non possono comparire sotto-query.** La documentazione Sanity è esplicita: *«Sub-queries are not supported in webhook projections or filters»*. Una stesura precedente del design vi metteva `*[_type == "project" && references(^._id)]._id`, e sarebbe stata rifiutata. È il motivo per cui le dipendenze inverse si risolvono nel route handler.

- [ ] **Step 4: Verificare il rifiuto delle richieste non firmate**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<dominio>/api/revalidate \
  -H 'content-type: application/json' -d '{"_type":"photo","_id":"x"}'
```

Atteso: **401**. Se restituisce 200, la firma non viene verificata e l'endpoint è aperto a chiunque.

- [ ] **Step 5: Verificare il ciclo completo**

1. Nello Studio, cambiare il titolo di un progetto e pubblicare.
2. Nel pannello webhook di Sanity, controllare che la consegna sia andata a buon fine (200).
3. Visitare la pagina del progetto sul dominio pubblico.

Atteso: il nuovo titolo compare. **L'invalidazione si materializza alla visita successiva**, non al momento della pubblicazione: se la prima richiesta mostra ancora il vecchio valore, ricaricare una volta prima di concludere che non funziona.

4. Verificare che una pagina **non** coinvolta non sia stata rigenerata, controllando l'header `x-vercel-cache` su `/it/about`: deve restare `HIT`.

- [ ] **Step 6: Registrare l'esito**

Annotare nel piano l'esito reale, compresi eventuali scostamenti. Se il webhook non arriva, il pannello di Sanity permette di rigiocare una consegna: usarlo per diagnosticare invece di ripubblicare a ripetizione.

---

## Task 13: Stati di resilienza

**Files:**
- Modify: `views/ProjectView.tsx`, `views/ProjectsView.tsx`
- Test: `views/__tests__/resilienza.test.tsx`

- [ ] **Step 1: Scrivere i test che falliscono**

Coprono la specifica di prodotto §12 con dati degradati: progetto senza fotografie, copertina mancante, descrizione assente in entrambe le lingue, anno mancante. In nessun caso la pagina deve lanciare.

- [ ] **Step 2: Implementare e verificare**

Le query filtrano già i riferimenti nulli con `[defined(@)]`; questo task verifica che i componenti reggano il risultato.

- [ ] **Step 3: Commit**

```bash
git add views
git commit -m "test: stati degradati delle pagine di progetto"
```

---

## Task 14: End-to-end della Fase 2

**Files:**
- Create: `e2e/projects.spec.ts`, `e2e/seo.spec.ts`
- Modify: `e2e/a11y.spec.ts`

- [ ] **Step 1: Scrivere gli e2e dei progetti**

Copertura: indice in entrambe le lingue, apertura di un progetto, ordine delle fotografie nella sequenza, lightbox che si apre dalla pagina di progetto e restituisce il focus, 404 su slug inesistente, selettore lingua che resta sulla stessa pagina di progetto conservando lo slug.

- [ ] **Step 2: Scrivere gli e2e dei metadati**

Canonical presente e assoluto, due `hreflang` con i segmenti tradotti, `og:image` con `fm=jpg`, sitemap che elenca le pagine di progetto, robots che esclude `/studio`.

- [ ] **Step 3: Estendere lo scan di accessibilità**

Aggiungere `/it/progetti`, `/en/projects` e una pagina di progetto all'elenco delle pagine scansionate, in entrambi i temi.

- [ ] **Step 4: Eseguire tutto**

```bash
npm run typecheck && npm test && npm run e2e
```

Le violazioni axe vanno corrette nel componente che le causa, non silenziate.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: e2e di progetti, metadati e accessibilità"
```

---

## Task 15: Verifiche di checkpoint

Questo task produce prove, non codice.

- [ ] **Step 1: Generazione statica**

`npm run build` deve mostrare come SSG: `/it`, `/en`, le due gallerie, i due indici progetti, le quattro pagine di progetto e le due About. Se una compare come dinamica, una Dynamic API è entrata nella catena.

- [ ] **Step 2: Metadati sul dominio pubblico**

Su una pagina di progetto in produzione, verificare canonical assoluto, entrambi gli `hreflang` e `og:image` con formato fissato.

- [ ] **Step 3: Anteprima social reale**

Incollare l'URL di una pagina di progetto in un validatore di anteprime social e verificare che l'immagine venga renderizzata. È l'unico modo di sapere se `fm=jpg` era necessario davvero.

- [ ] **Step 4: Ciclo editoriale**

Il Task 12 Step 5, ripetuto su un tipo di documento diverso — una fotografia invece di un progetto — per esercitare la risoluzione delle dipendenze inverse.

- [ ] **Step 5: Suite completa**

```bash
npm run typecheck && npm test && npm run e2e
```

Riportare i numeri reali.

---

## Criteri di completamento della Fase 2

1. `/it/progetti` e `/en/projects` elencano i progetti con copertina, titolo e anno.
2. Le pagine di progetto mostrano introduzione e sequenza verticale nell'ordine scelto dall'editor.
3. La lightbox si apre dalle pagine di progetto e restituisce il focus alla fotografia di origine.
4. Uno slug inesistente restituisce **404**, non una pagina vuota.
5. Il selettore lingua resta sulla stessa pagina di progetto, conservando lo slug.
6. Ogni pagina pubblica dichiara canonical assoluto e due `hreflang` con i segmenti tradotti.
7. `og:image` usa un formato fissato e l'anteprima è renderizzata da un validatore reale.
8. `sitemap.xml` elenca tutte le pagine pubbliche in entrambe le lingue; `robots.txt` esclude `/studio` e `/api/`.
9. `POST /api/revalidate` senza firma valida restituisce **401**.
10. Pubblicare un progetto ne aggiorna la pagina; pubblicare una fotografia aggiorna le pagine che la mostrano; le pagine non coinvolte restano in cache.
11. Nessuna violazione axe sulle pagine nuove, in entrambi i temi.
12. Le rotte restano prerenderizzate.
13. `npm run typecheck`, `npm test` e `npm run e2e` passano.

Resta aperto per dichiarazione, come nelle fasi precedenti, il criterio sulla qualità fotografica: richiede fotografie reali.

---

## Self-review

**Copertura del design:** §5.2 tag → Task 10, 11; §5.3 webhook → Task 11, 12; §10 SEO e semantica → Task 8, 9; §13 resilienza → Task 13; specifica di prodotto §8.4 progetti → Task 5, 6; §6 URL e hreflang → Task 7, 8.

**Consistenza dei tipi:** `ProjectSummary` e `ProjectDetail` sono definiti una volta in `lib/projects/toProject.ts` e consumati da `ProjectsView`, `ProjectView` e i loro test. `GalleryPhoto` resta il tipo unico delle fotografie, riusato dalla sequenza di progetto. `Resolved` da `lib/i18n/routes.ts` è il parametro di `buildPageMetadata`, così canonical e `hreflang` non possono divergere dai percorsi reali. `WebhookPayload` è definito in `lib/revalidation/tags.ts` e usato dal route handler e da `dependents.ts`.

**Prerequisiti dichiarati, non impliciti:** il Task 1 esiste perché senza progetti e senza `socialImage` metà dei criteri di completamento non sono verificabili. Il Task 12 richiede un segreto che deve incollare l'utente, e un webhook la cui creazione da CLI va verificata prima di essere assunta.

**Cosa questo piano non copre**, e non per dimenticanza: il tool «Carica fotografie», la document action con il report delle bozze, l'anteprima autenticata e gli e2e che entrano nello Studio restano in Fase 3.
