/**
 * URL assoluto del sito, per canonical, hreflang, sitemap e Open Graph.
 *
 * Ordine deliberato:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, l'unico che conosce il dominio definitivo. Su un
 *    dominio proprio e l'unico valore corretto.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL`, stabile fra un deploy e l'altro: senza
 *    di esso ogni pubblicazione cambierebbe i canonical, dicendo ai motori di
 *    ricerca che il sito trasloca a ogni build.
 * 3. `VERCEL_URL`, che identifica il singolo deploy. Va bene per le anteprime.
 * 4. localhost, per lo sviluppo.
 *
 * Serve perche il primo deploy avviene prima che il dominio sia noto: senza
 * questa scala, i metadati punterebbero a localhost sul sito pubblicato.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (productionHost) return `https://${productionHost}`

  const deploymentHost = process.env.VERCEL_URL?.trim()
  if (deploymentHost) return `https://${deploymentHost}`

  return 'http://localhost:3000'
}
