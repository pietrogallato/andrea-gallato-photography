# Home statica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La home diventa una sola schermata: la fotografia di apertura riempie lo schermo, la pagina non scorre, e un collegamento discreto porta alla galleria.

**Architecture:** Il footer esce dal layout condiviso ed entra nelle pagine, perché in Next un layout non riceve i segmenti della rotta figlia e quindi non può sapere di stare avvolgendo la home. La sezione di apertura passa da `height` a `min-height` con il contenuto nel flusso normale: il non scorrimento diventa una conseguenza del layout invece di un divieto, e quando il contenuto non ci sta la pagina scorre da sola.

**Tech Stack:** Next 16.3 App Router, React 19.2, CSS Modules, Vitest, Playwright.

**Documento normativo:** [design della home statica](../specs/2026-08-14-home-statica-design.md)

---

## Correzione alla spec, decisa scrivendo il piano

La spec dice che la 404 «rende sempre il footer». Scrivendo il piano è emerso che
`app/[locale]/not-found.tsx` **non riceve `params`**: in Next una `not-found` non ha accesso
al locale. Il footer però non contiene testo localizzato — solo `© anno nome` e una mail —
quindi il suo parametro `locale` non serve a nulla ed è oggi inutilizzato.

Il piano quindi **rimuove il parametro `locale` da `Footer`** (Task 2). È una semplificazione
di tre righe in un componente che stiamo comunque toccando, e rende la 404 pulita invece di
costringerla a inventarsi un locale.

---

## Struttura dei file

| File | Responsabilità dopo il lavoro |
|---|---|
| `app/[locale]/layout.tsx` | Header e `<main>`. Non conosce più il footer. |
| `app/[locale]/[[...segments]]/page.tsx` | Sceglie la vista **e** decide se il footer va reso |
| `app/[locale]/preview/[[...segments]]/page.tsx` | Stessa decisione, per l'anteprima |
| `app/[locale]/not-found.tsx` | Rende il proprio footer |
| `components/layout/Footer.tsx` | Copyright ed email. Nessun parametro inutilizzato. |
| `views/HomeView.tsx` | La schermata di apertura, con il collegamento alla galleria |
| `views/HomeView.module.css` | Altezza minima e contenuto nel flusso |
| `lib/i18n/dictionaries/{it,en}.ts` | L'etichetta del collegamento |
| `e2e/home.spec.ts` | **Nuovo.** Il non scorrimento, la sua eccezione, il footer assente e l'invito |

---

## Task 1: I test che definiscono il lavoro

Si scrivono per primi e **devono fallire tutti**. Quello sullo schermo basso è il più
importante: senza di lui, un `overflow: hidden` farebbe passare gli altri due sul non
scorrimento, tagliando via l'introduzione a chi ha ingrandito i caratteri.

**Files:**
- Create: `e2e/home.spec.ts`

- [ ] **Step 1: Scrivere i test**

```ts
import { test, expect } from './fixtures'

/**
 * La home e una sola schermata. Il criterio e misurabile: l altezza del
 * documento non supera quella della finestra.
 */
async function scorre(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )
}

test('la home non scorre su desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/it')
  expect(await scorre(page)).toBe(false)
})

test('la home non scorre su telefono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/it')
  expect(await scorre(page)).toBe(false)
})

/**
 * L eccezione, e il motivo per cui esiste questo test: su uno schermo troppo
 * basso il contenuto non ci sta. La pagina deve **scorrere**, non tagliare:
 * WCAG 1.4.4 chiede che il testo possa raddoppiare senza perdere contenuto.
 * Senza questo test, un `overflow: hidden` farebbe passare gli altri due.
 */
test('su uno schermo basso la home scorre invece di tagliare', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 340 })
  await page.goto('/it')

  expect(await scorre(page)).toBe(true)

  // L introduzione resta raggiungibile: e cio che si sarebbe perso tagliando.
  const intro = page.locator('main p').first()
  await intro.scrollIntoViewIfNeeded()
  await expect(intro).toBeVisible()
})

test('il footer non e nella home ed e nelle altre pagine', async ({ page }) => {
  await page.goto('/it')
  await expect(page.locator('footer')).toHaveCount(0)

  for (const percorso of ['/it/fotografie', '/it/progetti', '/it/about']) {
    await page.goto(percorso)
    await expect(page.locator('footer')).toHaveCount(1)
  }
})

test('l invito porta alla galleria, con l etichetta della lingua', async ({ page }) => {
  await page.goto('/it')
  const it = page.getByRole('link', { name: 'Guarda le fotografie' })
  await expect(it).toHaveAttribute('href', '/it/fotografie')

  await page.goto('/en')
  const en = page.getByRole('link', { name: 'See the photographs' })
  await expect(en).toHaveAttribute('href', '/en/photographs')
})

test('l invito e raggiungibile e ha un area di tocco sufficiente', async ({ page }) => {
  await page.goto('/it')
  const invito = page.getByRole('link', { name: 'Guarda le fotografie' })

  const box = await invito.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)

  await invito.click()
  await expect(page).toHaveURL('/it/fotografie')
})
```

**Perché l'invito si verifica qui e non in un test unitario.** In questo progetto non
esiste alcun test unitario di una vista asincrona: le viste sono componenti server e sono
sempre state verificate dagli end-to-end. Introdurre qui uno schema nuovo — rendere una
funzione `async` con Testing Library — significherebbe scommettere su una tecnica mai usata
in questo repository, dentro un task che ha altro da dimostrare.

- [ ] **Step 2: Eseguirli e verificare che falliscano**

```bash
npx playwright test --project=chromium e2e/home.spec.ts
```

Atteso: **sei fallimenti su sei.**

| Test | Perché fallisce ora |
|---|---|
| non scorre su desktop | il footer aggiunge altezza |
| non scorre su telefono | stessa causa |
| coi caratteri al 200% scorre | `home-intro` non esiste ancora (Task 3) |
| footer assente nella home | il footer e ancora nel layout |
| l'invito porta alla galleria | il collegamento non esiste |
| l'invito e raggiungibile | stessa causa |

**Una trappola nell'ordine dei task, misurata il 14 agosto 2026.** Dentro il test sullo
schermo basso, l'asserzione `scorre(page) === true` **passa fin da ora**, ma per la ragione
sbagliata: a 640×340 la sezione di apertura (`92dvh`, cioè ~298px) ci sta dentro e
l'introduzione è già visibile a y≈207. A far scorrere la pagina è il **footer**, che occupa
da y≈442 a y≈580.

Quando il Task 2 toglierà il footer, l'altezza scenderà a ~298px sotto i 340 del viewport e
quella asserzione comincerà a fallire — stavolta per il motivo vero, cioè il contenuto in
posizione assoluta che verrebbe tagliato. Il Task 3 la fa tornare verde.

Chi esegue il Task 2 deve quindi vedere il messaggio di questo test **cambiare**: da
«`home-intro` non trovato» a «expected true, received false». Se continuasse a lamentare
solo il testid, vorrebbe dire che il footer non è stato davvero rimosso dalla home.

**Nota sul locatore.** Il test cerca l'introduzione con `getByTestId('home-intro')` invece
che con `main p`: quest'ultimo reggeva solo per coincidenza, perché oggi nella home c'è un
solo paragrafo. L'attributo viene aggiunto dal Task 3.

- [ ] **Step 3: Commit**

```bash
git add e2e/home.spec.ts
git commit -m "Il criterio della home statica, scritto come test che ancora fallisce"
```

---

## Task 2: Il footer scende dal layout alle pagine

**Files:**
- Modify: `components/layout/Footer.tsx`
- Modify: `app/[locale]/layout.tsx`
- Modify: `app/[locale]/[[...segments]]/page.tsx`
- Modify: `app/[locale]/preview/[[...segments]]/page.tsx`
- Modify: `app/[locale]/not-found.tsx`

- [ ] **Step 1: Togliere da `Footer` il parametro inutilizzato**

In `components/layout/Footer.tsx`, sostituire le prime 13 righe con:

```tsx
import styles from './Footer.module.css'

/**
 * Non riceve la lingua perche non ha testo localizzato: solo l anno, il nome e
 * una mail. Il parametro c era e non veniva usato, e senza di esso la pagina
 * 404 — che in Next non riceve `params` — puo renderlo senza inventarsi un
 * locale.
 */
export function Footer({
  siteName,
  email,
}: {
  siteName: string
  email?: string
}) {
  const year = new Date().getFullYear()
```

Il resto del file resta invariato.

- [ ] **Step 2: Toglierlo dal layout**

In `app/[locale]/layout.tsx`, cancellare la riga di import di `Footer` e la riga:

```tsx
        <Footer locale={locale} siteName={siteName} email={settings?.email ?? undefined} />
```

- [ ] **Step 3: Renderlo nella catch-all, per ogni rotta tranne la home**

Sostituire il corpo di `Page` in `app/[locale]/[[...segments]]/page.tsx` (righe 92-124) con:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>
}) {
  const { locale, segments } = await params
  if (!isLocale(locale)) notFound()

  const route = resolveRoute(locale, segments ?? [])
  if (!route) notFound()

  // Letto una volta sola: serve al nome del fotografo e al footer.
  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })
  const siteName = settings?.photographerName ?? 'Andrea Gallato'

  // La home e una sola schermata: il footer e cio che la farebbe scorrere.
  // La decisione sta qui perche il layout non riceve i segmenti della rotta.
  const conFooter = route.key !== 'home'

  return (
    <>
      {route.key === 'home' ? <HomeView locale={locale} siteName={siteName} /> : null}
      {route.key === 'gallery' ? <GalleryView locale={locale} /> : null}
      {route.key === 'projects' ? <ProjectsView locale={locale} /> : null}
      {route.key === 'project' ? <ProjectView locale={locale} slug={route.slug} /> : null}
      {route.key === 'about' ? <AboutView locale={locale} siteName={siteName} /> : null}

      {conFooter ? <Footer siteName={siteName} email={settings?.email ?? undefined} /> : null}
    </>
  )
}
```

Aggiungere in cima al file:

```tsx
import { Footer } from '@/components/layout/Footer'
```

- [ ] **Step 4: Stessa regola nell'anteprima**

In `app/[locale]/preview/[[...segments]]/page.tsx`, aggiungere l'import:

```tsx
import { Footer } from '@/components/layout/Footer'
```

e, subito prima della chiusura `</>` del `return`, aggiungere:

```tsx
      {route.key !== 'home' ? (
        <Footer siteName={siteName} email={settings?.email ?? undefined} />
      ) : null}
```

- [ ] **Step 5: Renderlo nella 404**

Sostituire `app/[locale]/not-found.tsx` con:

```tsx
import Link from 'next/link'
import { Footer } from '@/components/layout/Footer'
import { sanityFetch } from '@/lib/sanity/fetch'
import { siteSettingsQuery } from '@/lib/sanity/queries'

export default async function NotFound() {
  const settings = await sanityFetch({ query: siteSettingsQuery, tags: ['settings'] })

  return (
    <>
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

      <Footer siteName={settings?.photographerName ?? 'Andrea Gallato'} email={settings?.email ?? undefined} />
    </>
  )
}
```

- [ ] **Step 6: Verificare**

```bash
npm run typecheck
npx playwright test --project=chromium e2e/home.spec.ts
```

Atteso: passano `la home non scorre su desktop`, `la home non scorre su telefono` e
`il footer non e nella home ed e nelle altre pagine`. **Continua a fallire**
`su uno schermo basso la home scorre invece di tagliare`: il contenuto e ancora in posizione
assoluta e viene tagliato.

- [ ] **Step 7: Commit**

```bash
git add components/layout/Footer.tsx app/
git commit -m "Il footer scende dal layout alle pagine, che sanno quale rotta stanno rendendo"
```

---

## Task 3: La sezione di apertura diventa una schermata che sa crescere

**Files:**
- Modify: `views/HomeView.tsx`
- Modify: `views/HomeView.module.css`

- [ ] **Step 1: Portare il contenuto nel flusso**

In `views/HomeView.tsx`, sostituire il `return` finale con:

```tsx
  return (
    <section className={`${styles.hero} surface-dark`}>
      <SanityImage
        photo={{
          url: hero.url,
          aspectRatio: hero.ar,
          lqip: hero.lqip,
          alt: hero.alt,
          altLang: hero.altLang,
        }}
        sizes="100vw"
        locale={locale}
        priority
        className={styles.heroImage}
      />

      {/* Velatura fissa e non dipendente dallo scatto: il testo in
          sovrimpressione deve avere un contrasto garantito qualunque
          fotografia il fotografo scelga come protagonista. */}
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.content}>
        <h1 className={styles.title}>{siteName}</h1>
        {intro.value ? (
          <p className={styles.intro} lang={introLang} data-testid="home-intro">
            {intro.value}
          </p>
        ) : null}
      </div>
    </section>
  )
```

**L'unica modifica al markup è `data-testid="home-intro"`.** Serve al test dello schermo
basso, che deve poter raggiungere l'introduzione senza pescarla per posizione: `main p`
reggeva solo perché oggi nella home c'è un paragrafo solo, e sarebbe bastato spezzare il
testo in due per farlo puntare altrove in silenzio. Un `data-testid` e non una classe del
CSS Module, il cui nome viene generato in fase di build.

- [ ] **Step 2: Riscrivere le regole di altezza**

In `views/HomeView.module.css`, sostituire i blocchi `.hero`, `.scrim`, `.content` e la
media query con:

```css
/* La specifica 8.2 vuole la protagonista quasi a schermo intero. L header e
   adesivo e traslucido, quindi la fotografia gli scorre sotto: da qui il
   margine negativo che recupera l altezza dell header.

   `min-height` e non `height`: e cio che distingue «la pagina non scorre»
   da «la pagina non puo scorrere». In condizioni normali il contenuto sta
   dentro e il documento non supera la finestra. Quando il contenuto cresce
   — telefono in orizzontale, caratteri al 200% — spinge la sezione e la
   pagina scorre, invece di tagliare via l introduzione. */
.hero {
  position: relative;
  min-height: 100dvh;
  margin-top: calc(-1 * var(--header-height));
  overflow: hidden;
  isolation: isolate;

  /* Il contenuto vive nel flusso e si appoggia in basso. Con
     `position: absolute` non partecipava all altezza del genitore: crescendo
     usciva dallo schermo senza poterlo allungare, ed e esattamente il difetto
     che questo lavoro deve evitare. */
  display: grid;
  grid-template-rows: 1fr auto;
}

.scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to top,
    rgb(0 0 0 / 0.78) 0%,
    rgb(0 0 0 / 0.45) 28%,
    rgb(0 0 0 / 0.08) 58%,
    rgb(0 0 0 / 0.25) 100%
  );
}

.content {
  position: relative;
  z-index: 2;
  grid-row: 2;
  width: 100%;
  padding: var(--space-6) var(--space-5) var(--space-7);
  max-width: var(--content-max);
  margin: 0 auto;
  display: grid;
  gap: var(--space-4);
}

@media (max-width: 767px) {
  /* Sotto il breakpoint l header e piu basso: usare il token desktop faceva
     risalire la fotografia di 16px piu del dovuto. Prima non si notava perche
     sotto c era il footer; con la home a schermo esatto la pagina risulterebbe
     piu corta della finestra. */
  .hero {
    margin-top: calc(-1 * var(--header-height-compact));
  }

  .content {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }
}
```

Sostituire anche il blocco `.heroImage`, che ora convive con elementi posizionati e deve
restare dietro:

```css
/* Annulla il rapporto d aspetto di SanityImage: qui la fotografia riempie il
   riquadro. E l unico ritaglio del sito, e la specifica 8.2 lo consente
   esplicitamente per adattamenti controllati sulla protagonista. */
.heroImage {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  animation: fade var(--duration-reveal) var(--ease) both;
}
```

**`overflow: hidden` resta** su `.hero`: serve a contenere la fotografia, e non impedisce
alla sezione di crescere, perché il contenuto che la fa crescere sta dentro di essa.

- [ ] **Step 3: Verificare**

```bash
npx playwright test --project=chromium e2e/home.spec.ts
```

Atteso: **tutti e quattro i test passano**, compreso
`su uno schermo basso la home scorre invece di tagliare`.

- [ ] **Step 4: Commit**

```bash
git add views/HomeView.module.css views/HomeView.tsx
git commit -m "La home e una schermata che sa crescere invece di tagliare"
```

---

## Task 4: L'invito verso la galleria

I test esistono già: sono i due scritti nel Task 1, che a questo punto falliscono ancora.

**Files:**
- Modify: `lib/i18n/dictionaries/it.ts`
- Modify: `lib/i18n/dictionaries/en.ts`
- Modify: `views/HomeView.tsx`
- Modify: `views/HomeView.module.css`

- [ ] **Step 1: Verificare che i test dell'invito falliscano**

```bash
npx playwright test --project=chromium e2e/home.spec.ts -g "invito"
```

Atteso: due FAIL, nessun collegamento con quel nome accessibile.

- [ ] **Step 2: Aggiungere le voci di dizionario**

In `lib/i18n/dictionaries/it.ts`, prima della chiusura dell'oggetto:

```ts
  homeEnter: 'Guarda le fotografie',
```

In `lib/i18n/dictionaries/en.ts`, prima della chiusura dell'oggetto:

```ts
  homeEnter: 'See the photographs',
```

- [ ] **Step 3: Aggiungere il collegamento**

In `views/HomeView.tsx`, aggiungere in cima:

```tsx
import Link from 'next/link'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
```

Dentro il componente, dopo `const introLang = ...`:

```tsx
  const dict = getDictionary(locale)
```

E dentro `<div className={styles.content}>`, subito dopo il paragrafo dell'introduzione:

```tsx
        <Link href={pathFor(locale, { key: 'gallery' })} className={styles.enter}>
          {dict.homeEnter}
          {/* Freccia orizzontale, mai verso il basso: sotto non c e nulla, e
              una freccia che promette scorrimento su una pagina che non scorre
              e il primo gesto che il visitatore tenta a vuoto. */}
          <span aria-hidden="true">→</span>
        </Link>
```

- [ ] **Step 4: Aggiungere lo stile**

In `views/HomeView.module.css`, in fondo al file:

```css
.enter {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  /* Area di tocco piena: il testo da solo sarebbe alto meno del minimo. */
  min-height: var(--target-min);
  color: var(--fg);
  text-decoration: none;
  font-size: 0.8125rem;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  border-bottom: 1px solid rgb(255 255 255 / 0.45);
  transition: border-color var(--duration-fast) var(--ease);
  animation: reveal var(--duration-reveal) var(--ease-out) both;
  animation-delay: 460ms;
}

.enter:hover,
.enter:focus-visible {
  border-bottom-color: var(--fg);
}
```

- [ ] **Step 5: Verificare**

```bash
npm run typecheck
npx playwright test --project=chromium e2e/home.spec.ts
```

Atteso: typecheck pulito e **tutti e sei** i test di `home.spec.ts` verdi.

- [ ] **Step 6: Commit**

```bash
git add lib/i18n/dictionaries views/
git commit -m "Un invito verso la galleria, che dice dove porta invece di promettere uno scorrimento"
```

---

## Task 5: Verifiche di chiusura

- [ ] **Step 1: Le suite intere**

```bash
npx vitest run
npm run e2e
```

Atteso: tutti verdi. In particolare i quattro test di `e2e/home.spec.ts` e i test esistenti
di navigazione, che toccano la home.

- [ ] **Step 2: Accessibilità sulla home nei due temi**

Il progetto ha già `@axe-core/playwright`. Verificare che `e2e/a11y.spec.ts` includa `/it` e
`/en` fra le pagine scansionate — le include già — ed eseguire:

```bash
npx playwright test --project=chromium e2e/a11y.spec.ts
```

Atteso: zero violazioni. Il collegamento nuovo ha contrasto sufficiente sulla velatura e
un'area di tocco di 44px.

- [ ] **Step 3: Guardare la home**

```bash
npm run build && npx next start -p 3000
```

Aprire `http://localhost:3000/it` e verificare a occhio: la fotografia riempie lo schermo,
non c'è barra di scorrimento, il collegamento si vede senza rubare la scena.

Poi rimpicciolire la finestra in altezza fino a ~340px e verificare che la pagina inizi a
scorrere invece di tagliare l'introduzione.

- [ ] **Step 4: Commit finale se sono serviti ritocchi**

```bash
git add -A
git commit -m "Ritocchi dopo la verifica visiva della home statica"
```

---

## Criteri di completamento

1. Sulla home, a 1280×800 e a 390×844, l'altezza del documento non supera quella della finestra.
2. Coi caratteri al 200% la home scorre e l'introduzione resta raggiungibile.
3. Il footer non compare nella home e compare su galleria, progetti, about e 404.
4. Il collegamento porta a `/it/fotografie` e a `/en/photographs` con l'etichetta della lingua giusta.
5. Zero violazioni axe sulla home nei due temi.
6. Le suite unitaria ed end-to-end restano verdi.
