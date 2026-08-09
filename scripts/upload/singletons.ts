import type { SanityClient } from '@sanity/client'

/**
 * Crea le tre pagine singole se mancano.
 *
 * **Crea, non sovrascrive.** `createIfNotExists` e la scelta centrale di
 * questo modulo: su un dataset gia popolato lo script non deve toccare nulla
 * di cio che Andrea ha scritto dallo Studio. Su un dataset vuoto — il caso
 * `production` — senza queste tre pagine la home mostrerebbe uno stato di
 * errore e l'about pure, perche le viste non hanno da dove leggere.
 *
 * Il ritratto dell'About resta **volutamente vuoto**: non esiste una
 * fotografia di Andrea fra quelle caricate, e usare uno dei suoi scatti di
 * strada renderebbe falso il testo alternativo, che dice «Ritratto di Andrea
 * Gallato». La vista regge l'assenza (rende solo i testi) e lo Studio segnala
 * il campo come obbligatorio: e il promemoria giusto, nel posto giusto.
 */
export async function ensureSingletons(
  client: SanityClient,
  { heroPhotoId, socialAssetId }: { heroPhotoId: string; socialAssetId: string },
): Promise<string[]> {
  const existing = await client.fetch<Record<string, string | null>>(
    `{
      "siteSettings": *[_type == "siteSettings"][0]._id,
      "homePage": *[_type == "homePage"][0]._id,
      "aboutPage": *[_type == "aboutPage"][0]._id
    }`,
  )

  // Rilevato prima di scrivere: dopo, `createIfNotExists` non distingue piu
  // fra «creato adesso» e «c'era gia».
  const created = ['siteSettings', 'homePage', 'aboutPage'].filter((id) => !existing[id])

  await client.createIfNotExists({
    _id: 'siteSettings',
    _type: 'siteSettings',
    photographerName: 'Andrea Gallato',
    seoTitleIt: 'Andrea Gallato — Fotografia',
    seoTitleEn: 'Andrea Gallato — Photography',
    // Descrive cio che il sito mostra davvero. Le venti fotografie pubblicate
    // sono tutte street: una descrizione piu larga sarebbe imprecisa proprio
    // dove conta, cioe nei risultati di ricerca.
    seoDescriptionIt: 'Fotografia di strada di Andrea Gallato.',
    seoDescriptionEn: 'Street photography by Andrea Gallato.',
    // L'immagine che si vede condividendo il link. Punta a un asset gia
    // caricato: gli asset sono documenti del dataset, non serve ricaricarlo.
    socialImage: { _type: 'image', asset: { _type: 'reference', _ref: socialAssetId } },
    // `email` qui e facoltativa e resta vuota: meglio nessun recapito che un
    // recapito inventato su una pagina pubblica.
  })

  await client.createIfNotExists({
    _id: 'homePage',
    _type: 'homePage',
    heroPhoto: { _type: 'reference', _ref: heroPhotoId },
    introIt: 'Fotografia di strada.',
    introEn: 'Street photography.',
  })

  await client.createIfNotExists({
    _id: 'aboutPage',
    _type: 'aboutPage',
    // Testi dichiaratamente provvisori. Non inventiamo una biografia: i fatti
    // su una persona reale li scrive lei, dallo Studio.
    bioIt:
      'Testo provvisorio, da sostituire dallo Studio. Qui va la biografia breve di Andrea Gallato: come ha iniziato a fotografare, che cosa fotografa, dove lavora.',
    bioEn:
      'Placeholder text, to be replaced from the Studio. This is where Andrea Gallato’s short biography goes: how he started photographing, what he photographs, where he works.',
    statementIt:
      'Testo provvisorio, da sostituire dallo Studio. Qui va lo statement artistico: che cosa cerca Andrea nelle sue fotografie, e perche.',
    statementEn:
      'Placeholder text, to be replaced from the Studio. This is where the artistic statement goes: what Andrea looks for in his photographs, and why.',
    // Lo schema la vuole obbligatoria e valida. `example.com` e il dominio
    // riservato apposta per i segnaposto: e leggibile come «da compilare» e
    // non recapita a nessuno. Va sostituita prima di dire in giro l'indirizzo.
    email: 'info@example.com',
  })

  return created
}
