<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Regole di progetto

Il sito e di Andrea Gallato, fotografo. Chi ti scrive spesso non e uno
sviluppatore: prima di cambiare qualcosa, di' in italiano e in una riga
cosa stai per fare.

## Ambiente

Node 24, obbligatorio: `.npmrc` impone `engine-strict=true` e qualunque
altra versione interrompe l'installazione. Il progetto si sviluppa anche
da Windows, in PowerShell.

## Prima di ogni commit

Esegui entrambi e falli passare:

    npm run typecheck
    npm test

Se falliscono non fare commit: spiega cosa e rotto e fermati. `npm run e2e`
richiede build e browser, dura molti minuti: eseguilo solo se ti viene
chiesto esplicitamente.

## Non toccare mai

- `.env.local` — contiene segreti. Non stamparne il contenuto, non citarlo
  in una risposta, non committarlo.
- `package-lock.json` a mano: cambia solo attraverso npm.
- `schema.json` e `lib/sanity/types.generated.ts` — sono generati da
  `npm run sanity:typegen`. Modificarli a mano dura fino alla prossima
  rigenerazione.
- Gli slug dei progetti gia pubblicati: cambiarli rompe i link salvati
  o condivisi da chi ha visto il sito.
- Gli script in `scripts/upload/` e `scripts/seed/`: scrivono direttamente
  sul Content Lake reale. Non eseguirli di tua iniziativa.

## Testi e fotografie non stanno nel codice

Stanno in Sanity. Se ti viene chiesto di cambiare un testo o una
fotografia del sito, verifica prima se e un contenuto Sanity: in quel
caso la risposta giusta e «si cambia dallo Studio, non da qui», non una
stringa scritta a mano dentro un componente.

Lo Studio su `localhost:3000/studio` non e un ambiente di prova: scrive
nello stesso Content Lake del sito pubblico. Pubblicare da li pubblica
davvero.

## Pubblicazione

Il repository e pubblico e ogni push su `main` pubblica il sito da solo,
senza altri passaggi. Non esiste una fase di approvazione: trattare ogni
push come una pubblicazione.

## Lingua

L'italiano e la lingua primaria del sito; l'inglese ricade sull'italiano
quando manca. Messaggi di commit in italiano.
