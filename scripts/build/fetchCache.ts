import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

/**
 * Percorso in cui Next persiste le risposte di `fetch` messe in cache.
 *
 * Non e un dettaglio scelto qui: e il percorso costruito da `FileSystemCache`
 * (`node_modules/next/dist/server/lib/incremental-cache/file-system-cache.js`),
 * dove il commento nel sorgente dichiara l'intento — "we store in
 * .next/cache/fetch-cache so it can be persisted across deploys".
 */
export function persistedFetchCacheDir(distDir: string): string {
  return path.join(distDir, 'cache', 'fetch-cache')
}

/**
 * Elimina la cache dei fetch ereditata dal build precedente.
 *
 * **Perche serve.** `sanityFetch` chiama `fetch` con `revalidate: false`: la
 * risposta non scade mai a tempo, per scelta (§5.1 del design). Next scrive
 * quelle risposte in `.next/cache/fetch-cache` e la chiave di cache — l'hash
 * di URL, metodo, header e opzioni — non contiene alcun identificativo del
 * build. Vercel ripristina `.next/cache` a ogni deploy, quindi il build
 * successivo trova le voci ancora valide e le riusa: renderizza lo stato del
 * dataset di *quando quelle voci sono state scritte*, non quello corrente.
 *
 * L'invalidazione per tag non copre il buco: `revalidateTag` scrive in un
 * manifest tenuto in memoria dal processo server, che non sopravvive al build.
 * Dalla combinazione dei due fatti segue che una voce riusata da un build
 * all'altro puo solo essere piu vecchia del dataset, mai piu recente. Ripubblicare
 * non e quindi un modo affidabile per aggiornare il contenuto, e la sitemap
 * perde in silenzio gli URL dei progetti creati dopo l'ultimo build.
 *
 * **Perche in `next.config.ts` e non in uno script npm.** La configurazione
 * viene caricata da `next build` comunque venga invocato; un hook `prebuild`
 * verrebbe saltato se la piattaforma eseguisse `next build` direttamente.
 *
 * **Perche non tutta `.next/cache`.** Accanto a `fetch-cache` vive la cache di
 * Turbopack, che accelera la compilazione senza influire sui dati: va
 * conservata. Il costo di questa rimozione e una query Sanity per ogni query
 * distinta del sito, una volta per build.
 *
 * Restituisce il percorso solo se c'era davvero qualcosa da rimuovere, cosi
 * che il chiamante possa registrarlo una volta sola: `next build` carica la
 * configurazione piu volte, e al primo build la directory non esiste ancora.
 * Restituisce `null` anche fuori dal build di produzione: in `next start`
 * cancellare questa directory toglierebbe a un server gia avviato la cache dei
 * dati che sta servendo.
 */
export function clearPersistedFetchCache({
  phase,
  distDir = '.next',
}: {
  phase: string
  distDir?: string
}): string | null {
  if (phase !== PHASE_PRODUCTION_BUILD) return null

  const dir = persistedFetchCacheDir(distDir)
  if (!existsSync(dir)) return null

  // `force` evita di fallire se qualcun altro ha gia rimosso la directory fra
  // il controllo e la chiamata.
  rmSync(dir, { recursive: true, force: true })

  return dir
}
