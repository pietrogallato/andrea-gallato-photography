# Fase 3 — Studio avanzato e verifiche finali — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il caricamento delle fotografie un gesto solo, chiudere le validazioni di pubblicazione con messaggi comprensibili, e portare a termine le verifiche che le fasi precedenti hanno lasciato aperte per dichiarazione.

**Architecture:** Il tool «Carica fotografie» è un tool personalizzato dello Studio, non un campo immagine: carica più file in parallelo, ciascuno con stato indipendente, e crea bozze già dotate di rank di ordinamento. Tutta la logica decidibile — deduplica, rank, macchina a stati per file — è pura e testata fuori dalla UI.

**Tech Stack:** Sanity 6.9 Studio, `@sanity/client` 7.26, Next 16.3, Vitest, Playwright.

**Documenti normativi:** [design §11.3, §11.4, §12, §15.4](../specs/2026-08-07-portfolio-fotografico-design.md) · [specifica di prodotto §10, §16, §17](../../../portfolio-fotografico-design.md)

**Stato di partenza, 8 agosto 2026:** Fasi 1 e 2 complete e in produzione. 240 test unitari, 192 e2e su quattro ambienti, zero violazioni axe su nove pagine. Ciclo editoriale verificato: pubblicare aggiorna solo le pagine coinvolte. Core Web Vitals nella fascia buona, CLS a zero.

---

## Vincoli già verificati, da non riscoprire

Questi sono stati misurati nelle fasi precedenti. Sono la parte del piano che vale di più.

| Vincolo | Conseguenza |
|---|---|
| `client.assets.upload` restituisce una **Promise**, senza eventi di avanzamento | La barra di progresso richiede `client.observable.assets.upload` e la sottoscrizione all'Observable |
| La perspective predefinita è `published` | La query di deduplica non vedrebbe le bozze che il tool stesso crea: serve `perspective: 'raw'` |
| `orderRank` è popolato solo da `initialValue`, cioè solo dal form dello Studio | Ogni creazione programmatica deve scriverlo, altrimenti la foto appare al 20% di opacità e non è trascinabile |
| I riferimenti forti **bloccano già** la pubblicazione con riferimenti in bozza | La document action non aggiunge il blocco: migliora solo il messaggio |
| `disabled` di una document action accetta solo un booleano | Il messaggio va in un `dialog`, non in un tooltip su un pulsante disabilitato |
| Una document action è invocata come **React hook**, non può essere async | La query va in `useState` + `useEffect`, con la action disabilitata mentre è in volo |
| `draftMode()` è **asincrona** in Next 16 | `const draft = await draftMode()` |
| La deduplica Sanity copre solo file **byte-identici** | Una riesportazione della stessa fotografia non viene rilevata: va detto all'editor |

---

## Task 1: Rank di ordinamento per il tool

**Files:** `sanity/tools/upload/orderRank.ts` esiste già come `sanity/lib/orderRank.ts` — verificarne il riuso invece di duplicarlo.

- [ ] **Step 1: Verificare che `nextOrderRank` sia riusabile dal browser**

`sanity/lib/orderRank.ts` è stato scritto per lo script di seed, che gira in Node. Il tool gira nel browser dello Studio. Verificare che non importi nulla di Node:

```bash
grep -nE "from 'node:|require\(" sanity/lib/orderRank.ts
```

Atteso: nessun risultato. Se ce ne sono, estrarre la parte pura.

- [ ] **Step 2: Aggiungere il test del caso concorrente**

Due caricamenti simultanei chiedono il rank massimo prima che il primo abbia scritto: otterrebbero lo stesso valore.

```ts
it('produce rank distinti anche partendo dallo stesso massimo', async () => {
  const client = clientReturning('0|hzzzzz:')
  const [a, b] = await Promise.all([
    nextOrderRank(client, 'photo'),
    nextOrderRank(client, 'photo'),
  ])
  // Se coincidono, due fotografie caricate insieme finiscono nella stessa
  // posizione e l ordine editoriale diventa arbitrario.
  expect(a).toBe(b)
})
```

Questo test **documenta un limite, non lo corregge**: con lo stesso massimo di partenza i rank coincidono. La correzione sta nel Task 3, che carica in sequenza e non in parallelo la parte che assegna il rank.

- [ ] **Step 3: Commit**

---

## Task 2: Deduplica

**Files:** Create `sanity/tools/upload/dedupe.ts`, test `sanity/tools/upload/__tests__/dedupe.test.ts`

- [ ] **Step 1: Scrivere i test**

```ts
describe('findDuplicatePhoto', () => {
  it('trova una photo che usa lo stesso asset', async () => { /* … */ })

  it('trova anche quando la photo esistente e solo una BOZZA', async () => {
    // La perspective predefinita e `published`: senza `raw` la query non
    // vedrebbe le bozze che il tool stesso ha appena creato, e ricaricando
    // lo stesso file si creerebbe un secondo documento.
  })

  it('preferisce il documento pubblicato quando esistono entrambi', async () => {
    // drafts.<id> e <id> sono lo stesso documento: va restituito uno solo.
  })

  it('restituisce null quando l asset non e referenziato', async () => { /* … */ })

  it('interroga con perspective raw', async () => {
    expect(client.withConfig).toHaveBeenCalledWith({ perspective: 'raw' })
  })
})
```

- [ ] **Step 2: Implementare**

```ts
export async function findDuplicatePhoto(client: SanityClient, assetId: string) {
  const trovati = await client
    .withConfig({ perspective: 'raw' })
    .fetch<{ _id: string }[]>(`*[_type == "photo" && image.asset._ref == $assetId]{_id}`, { assetId })

  if (!trovati?.length) return null

  // drafts.<id> e <id> sono lo stesso documento: si preferisce il pubblicato.
  const pubblicato = trovati.find((d) => !d._id.startsWith('drafts.'))
  return pubblicato ?? trovati[0]
}
```

- [ ] **Step 3: Commit**

---

## Task 3: Macchina a stati del caricamento

**Files:** Create `sanity/tools/upload/uploadState.ts`, test relativo

Ogni file ha uno stato indipendente. La logica è pura: la UI la rende, non la contiene.

- [ ] **Step 1: Scrivere i test**

Stati: `in-attesa` → `caricamento` (con percentuale) → `creata` | `duplicato` | `errore`.

Casi obbligatori:
- un fallimento **non** tocca lo stato degli altri file
- il retry riguarda **solo** i falliti, e non ricarica quelli riusciti
- un duplicato non è un errore: è un esito, e porta con sé l'id del documento esistente
- l'avanzamento complessivo si calcola dai singoli, senza superare il 100%

- [ ] **Step 2: Implementare**

- [ ] **Step 3: Commit**

---

## Task 4: Il tool nello Studio

**Files:** Create `sanity/tools/upload/UploadTool.tsx`, `useBatchUpload.ts`; modificare `sanity.config.ts`

- [ ] **Step 1: Scrivere `useBatchUpload`**

Per ogni file, indipendentemente dagli altri:

```ts
const sottoscrizione = client.observable.assets
  .upload('image', file)
  .subscribe({
    next: (event) => {
      if (event.type === 'progress') aggiorna(file, { percent: event.percent })
      if (event.type === 'response') completa(file, event.body.document)
    },
    error: (e) => fallisci(file, e),
  })
```

**`client.observable.assets.upload`, non `client.assets.upload`**: la seconda restituisce una Promise senza eventi di avanzamento, e la barra di progresso non sarebbe implementabile. L'`unsubscribe` è anche il meccanismo di annullamento.

Dopo il caricamento dell'asset, **in sequenza e non in parallelo**: deduplica, calcolo del rank, creazione della bozza. Il rank va assegnato in sequenza perché due chiamate concorrenti partirebbero dallo stesso massimo (Task 1).

La bozza nasce con `showInGallery: false` e **non** viene pubblicata.

- [ ] **Step 2: Scrivere `UploadTool.tsx`**

Rende soltanto lo stato: elenco dei file con percentuale, esito per ciascuno, collegamento al documento esistente per i duplicati, pulsante di retry attivo solo se ci sono falliti.

- [ ] **Step 3: Registrare il tool**

```ts
plugins: [structureTool({ structure: deskStructure }), /* … */],
tools: (prev) => [...prev, uploadTool()],
```

- [ ] **Step 4: Verifica manuale — RICHIEDE ACCESSO ALLO STUDIO**

Caricare tre file, di cui uno già presente. Attesi: due bozze nuove con `showInGallery` spento e rank assegnato, un duplicato segnalato con collegamento, nessuna pubblicazione automatica.

- [ ] **Step 5: Commit**

---

## Task 5: Document action con il report delle bozze

**Files:** Create `sanity/actions/publishWithDraftReferenceReport.ts`

- [ ] **Step 1: Verificare l'API prima di usarla**

```bash
node -e "const s=require('sanity'); console.log(Object.keys(s).filter(k=>/[Aa]ction/.test(k)).join(', '))"
```

Leggere la forma reale di `document.actions` invece di assumerla.

- [ ] **Step 2: Implementare**

L'azione **non blocca**: i riferimenti forti lo fanno già nativamente. Elenca per titolo le fotografie ancora in bozza, in un `dialog` — non in un tooltip, perché `disabled` accetta solo un booleano e un tooltip su un pulsante disabilitato non è raggiungibile da tastiera.

La query è asincrona ma l'azione è un hook: `useState` più `useEffect`, e mentre è in volo l'azione è disabilitata con un'etichetta che dice che sta verificando. Senza, c'è una frazione di secondo in cui risulta abilitata.

- [ ] **Step 3: Commit**

---

## Task 6: Modalità anteprima

**Files:** Create `app/api/preview/enable/route.ts`, `app/api/preview/disable/route.ts`

- [ ] **Step 1: Implementare l'attivazione**

```ts
const draft = await draftMode()   // asincrona in Next 16
draft.enable()
```

Il segreto si confronta a tempo costante e la destinazione si risolve da `ROUTES`, **mai** reindirizzando a un valore preso dalla query string: sarebbe un open redirect, e chiunque intercetti un link di anteprima potrebbe costruire un URL sul dominio del sito che rimanda altrove.

- [ ] **Step 2: Isolare l'anteprima dalle rotte pubbliche**

`sanityFetch` **non deve** chiamare `draftMode()`: è una Dynamic API, e essendo l'unico punto di accesso ai dati renderebbe dinamica ogni pagina del sito per tutti i visitatori.

- [ ] **Step 3: Verificare che le rotte pubbliche restino SSG**

```bash
npm run build
```

Se una rotta passa da `●` a `ƒ`, l'isolamento non ha funzionato.

- [ ] **Step 4: Commit**

---

## Task 7: End-to-end dentro lo Studio

**Files:** `playwright.config.ts`, `e2e/studio.setup.ts`, `e2e/studio.spec.ts`

- [ ] **Step 1: Autenticazione**

Progetto Playwright `setup` che inietta un token di utente di servizio in `localStorage['__sanity_auth_token_xpdypayk']` e salva `storageState`. Senza, i test si fermano alla schermata di login SSO.

La variabile `SANITY_E2E_AUTH_TOKEN` non è versionata e va aggiunta alla tabella del design §14.

- [ ] **Step 2: I test**

Caricamento multiplo con duplicati e fallimento parziale, retry selettivo, messaggio delle bozze bloccanti, anteprima autenticata.

- [ ] **Step 3: Commit**

---

## Task 8: Verifica di scala dello Studio

- [ ] **Step 1: Popolare 500 documenti**

```bash
SEED_DATASET=development SEED_COUNT=500 npx dotenv -e .env.local -- npm run seed
```

- [ ] **Step 2: Misurare**

Cronometrare il primo render dell'elenco Fotografie. Il plugin di ordinamento monta un'anteprima e una sottoscrizione **per ogni documento**, senza virtualizzazione: il rischio non è il trascinamento scomodo, è il pannello inutilizzabile.

La soglia di guardia è fissata a 150 fotografie (design §11.1). Se a 500 il pannello regge, alzarla nel documento; se non regge, confermarla e annotare la mitigazione.

- [ ] **Step 3: Ripulire**

Rimuovere i documenti eccedenti: `development` è anche il dataset degli end-to-end.

---

## Task 9: Passata di accessibilità con screen reader

Nessuna suite automatica sostituisce questa prova. Con VoiceOver o NVDA, verificare:

- l'annuncio dell'interruttore tema non è contraddittorio
- la lightbox si annuncia come finestra modale e il contenuto sotto non è raggiungibile
- l'annuncio della posizione cambia navigando con le frecce
- «Carica altre» annuncia il caricamento e il focus si sposta sulla prima nuova fotografia
- il testo italiano dentro le pagine inglesi viene pronunciato con la fonetica italiana

---

## Task 10: Chiusura

- [ ] Verifica dei contrasti in entrambi i temi su un campione di fotografie reali
- [ ] Taratura della qualità di compressione, oggi fissata a 85, su paesaggio, street e ritratto
- [ ] Rilettura dei criteri di accettazione della specifica §17, uno per uno, annotando l'esito

---

## Criteri di completamento

1. Il fotografo carica più immagini, completa i dati minimi, pubblica — senza toccare il codice.
2. Un file già presente viene segnalato come duplicato, con collegamento al documento esistente.
3. Un fallimento parziale conserva le bozze riuscite e il retry riguarda solo i falliti.
4. Le fotografie create dal tool sono trascinabili nello Studio: hanno un rank.
5. Il tentativo di pubblicare con riferimenti in bozza mostra **quali** fotografie mancano.
6. L'anteprima autenticata mostra le bozze; le rotte pubbliche restano SSG.
7. La verifica con screen reader non rileva problemi bloccanti.
8. Qualità di compressione tarata su fotografie reali.
9. Tutti i criteri della specifica §17 dichiarati, con l'esito annotato.

---

## Cosa richiede una persona

Il Task 4 Step 4, il Task 7 Step 1, il Task 8 e il Task 9 richiedono l'accesso allo Studio o un giudizio umano. Sono segnati nel piano invece di essere nascosti dentro un checkpoint generico.
