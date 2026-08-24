# Deploy su Vercel

## Perché l'importazione la fa una persona

Collegare Vercel a GitHub significa autorizzare l'app GitHub di Vercel sull'account, cioè concedere a un servizio terzo l'accesso ai repository. È una concessione di permessi che deve fare il titolare dell'account, non uno strumento per suo conto.

Una volta collegato, ogni `git push` su `main` pubblica da solo: è l'unico passo manuale dell'intera catena.

## Importazione

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `pietrogallato/andrea-gallato-photography`
2. Framework: Vercel rileva Next.js da solo. Non toccare build command, output directory né install command.
3. Prima di premere **Deploy**, aprire **Environment Variables** e incollare le tre righe della sezione seguente.

## Variabili d'ambiente

Necessarie al build. Senza, il client Sanity non sa quale progetto interrogare e il sito si pubblica vuoto.

```
NEXT_PUBLIC_SANITY_PROJECT_ID=xpdypayk
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-08-07
```

**`NEXT_PUBLIC_SITE_URL` non va impostata al primo deploy.** Il dominio non è ancora noto, e `lib/siteUrl.ts` ricade sull'URL di produzione fornito da Vercel — stabile fra un deploy e l'altro, quindi i canonical non cambiano a ogni pubblicazione. Va aggiunta soltanto quando esiste un dominio proprio, che è l'unico caso in cui Vercel non può indovinare il valore giusto.

### Sul dataset

Il valore è `production`: è dove vivono le fotografie vere di Andrea. Il passaggio da `development` è già avvenuto, e il sito pubblicato non mostra più segnaposto.

Il dataset `development` esiste ancora e contiene i placeholder della fase di costruzione. Serve solo a chi lavora sul codice e vuole contenuti da buttare; non va mai rimesso nelle variabili di Vercel.

### Variabili che serviranno più avanti

Non ancora, perché il codice che le legge non esiste:

| Variabile | Da quando | A cosa serve |
|---|---|---|
| `SANITY_API_READ_TOKEN` | Fase 3 | Leggere le bozze in anteprima |
| `SANITY_REVALIDATE_SECRET` | Fase 2 | Verificare la firma del webhook |
| `SANITY_PREVIEW_SECRET` | Fase 3 | Attivare la modalità anteprima |

Nessuna ha prefisso `NEXT_PUBLIC_` e nessuna deve averlo: finirebbe nel bundle servito al browser.

## Dopo il primo deploy

**1. Autorizzare l'origine su Sanity.** Lo Studio a `/studio` gira nel browser: senza questo passo il dominio Vercel non può parlare con Sanity e lo Studio pubblicato resta bloccato al caricamento.

```bash
npx sanity@latest cors add https://<dominio-vercel> --credentials
```

**2. Verificare che le rotte siano prerenderizzate.** Nel log di build devono comparire `/it`, `/en`, `/it/fotografie`, `/en/photographs`, `/it/about`, `/en/about` come SSG. Se compaiono come dinamiche, una Dynamic API è entrata nella catena e l'intera strategia di cache è annullata.

**3. Controllare i metadati.** `curl -s https://<dominio>/it | grep -o '<title>[^<]*</title>'` deve restituire il titolo SEO da Sanity, non il nome di ripiego.

**4. Controllare che il build abbia riletto Sanity.** Nel log deve comparire una riga come:

```
- Cache dei fetch rimossa (.next/cache/fetch-cache): il build rilegge Sanity
```

Vercel ripristina la cache di build fra un deploy e l'altro, e le risposte di Sanity vi restano valide a tempo indeterminato — sono messe in cache con `revalidate: false`. Senza quella rimozione il build renderizza i dati del build precedente, e il sintomo più visibile è una sitemap a cui mancano i progetti creati nel frattempo. La riga manca solo al primo deploy, quando non c'è ancora nulla da rimuovere.

## Nota sulla visibilità

Il repository è **pubblico**, ed è una scelta obbligata più che un'apertura: su piano Hobby, Vercel costruisce i commit di una seconda persona soltanto se il repository non è privato. Senza questo, i push di Andrea verrebbero rifiutati in silenzio.

Ne discende una regola pratica: qualunque cosa entri nel repository è leggibile da chiunque. I segreti stanno in `.env.local`, che non è versionato, e nelle variabili d'ambiente di Vercel — nient'altro.

Il sito pubblicato contiene ormai le fotografie di Andrea: è una pubblicazione a tutti gli effetti, e va trattata come tale.
