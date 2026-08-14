import { makeUploadClient } from '../upload/client'

/**
 * Popola e ripulisce il dataset per la prova di scala dello Studio.
 *
 * Serve a mettere alla prova una soglia che finora e solo un'ipotesi: il
 * plugin di ordinamento monta un'anteprima e una sottoscrizione **per ogni
 * documento**, senza virtualizzazione, e il design fissa la guardia a 150
 * fotografie senza averla mai verificata. Il rischio non e il trascinamento
 * scomodo, e il pannello inutilizzabile.
 *
 * **Non carica immagini.** I documenti riusano un asset gia presente: cio che
 * si vuole misurare e il costo per documento del pannello, non la banda. Cosi
 * la preparazione dura secondi invece di mezz'ora, e non lascia asset dietro.
 *
 * Gli id hanno un prefisso tutto loro, ed e quello che rende la pulizia
 * verificabile: si cancella per prefisso e si ricontano i documenti.
 */

const PREFISSO = 'scala-photo-'
const QUANTI = Number(process.env.SCALA_COUNT ?? 500)
const LOTTO = 50

export const idScala = (n: number) => `${PREFISSO}${String(n).padStart(4, '0')}`

const { client, dataset } = makeUploadClient()

async function conta(): Promise<{ totali: number; diProva: number }> {
  const [totali, diProva] = await Promise.all([
    client.fetch<number>(`count(*[_type == "photo"])`),
    client.fetch<number>(`count(*[_type == "photo" && string::startsWith(_id, $p)])`, {
      p: PREFISSO,
    }),
  ])
  return { totali, diProva }
}

async function crea() {
  const asset = await client.fetch<string | null>(
    `*[_type == "photo" && defined(image.asset) && !string::startsWith(_id, $p)][0].image.asset._ref`,
    { p: PREFISSO },
  )
  if (!asset) throw new Error('Nessun asset da riusare: serve almeno una fotografia vera.')

  for (let i = 0; i < QUANTI; i += LOTTO) {
    const tx = client.transaction()
    for (let n = i; n < Math.min(i + LOTTO, QUANTI); n++) {
      tx.createOrReplace({
        _id: idScala(n),
        _type: 'photo',
        image: { _type: 'image', asset: { _type: 'reference', _ref: asset } },
        altIt: `Documento di prova ${n + 1}, creato per misurare lo Studio`,
        showInGallery: false,
        // Rank crescenti e distinti: il pannello ordinabile li usa per
        // disporli, e valori uguali falserebbero proprio cio che si misura.
        orderRank: `0|scala${String(n).padStart(5, '0')}:`,
      })
    }
    await tx.commit()
    process.stdout.write(`\r  creati ${Math.min(i + LOTTO, QUANTI)}/${QUANTI}`)
  }
  console.log()
}

async function rimuovi() {
  await client.delete({ query: `*[_type == "photo" && string::startsWith(_id, $p)]`, params: { p: PREFISSO } })
}

async function main() {
  const azione = process.argv[2]
  if (azione !== 'crea' && azione !== 'rimuovi') {
    console.error('Uso: crea | rimuovi')
    process.exit(1)
  }

  const prima = await conta()
  console.log(`Dataset "${dataset}": ${prima.totali} fotografie, di cui ${prima.diProva} di prova.`)

  if (azione === 'crea') {
    await crea()
  } else {
    await rimuovi()
  }

  const dopo = await conta()
  console.log(`Ora: ${dopo.totali} fotografie, di cui ${dopo.diProva} di prova.`)

  if (azione === 'rimuovi' && dopo.diProva !== 0) {
    console.error('Restano documenti di prova: la pulizia non e completa.')
    process.exit(1)
  }
  if (azione === 'rimuovi' && dopo.totali !== prima.totali - prima.diProva) {
    console.error('Il conto non torna: sono spariti documenti che non erano di prova.')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
