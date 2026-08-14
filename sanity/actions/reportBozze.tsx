import { useEffect, useState } from 'react'
import { useClient, type DocumentActionComponent, type DocumentActionProps } from 'sanity'
import { Stack, Text } from '@sanity/ui'
import {
  idBozza,
  riepilogo,
  riferimentiNonPubblicati,
  titoloDellaBozza,
  type BozzaMancante,
  type RiferimentoFotografia,
} from './bozzeMancanti'

const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2024-01-01'

type Progetto = {
  cover?: RiferimentoFotografia | null
  photos?: (RiferimentoFotografia | null)[] | null
}

/**
 * Elenca le fotografie del progetto ancora in bozza.
 *
 * **Non blocca niente.** I riferimenti forti impediscono gia di pubblicare un
 * progetto che punta a bozze: questa azione non aggiunge un divieto, aggiunge
 * il **quali**, che il messaggio nativo non dice.
 *
 * Il messaggio va in un dialog e non in un tooltip su un pulsante
 * disabilitato: `disabled` accetta solo un booleano, e un tooltip su un
 * pulsante disabilitato non e raggiungibile da tastiera.
 */
export const reportBozzeAction: DocumentActionComponent = (props: DocumentActionProps) => {
  const { id, draft, published } = props
  const client = useClient({ apiVersion: API_VERSION })

  const [bozze, setBozze] = useState<BozzaMancante[] | null>(null)
  const [aperto, setAperto] = useState(false)

  // Il documento in bozza e quello che l'editor sta guardando; se non c'e,
  // vale il pubblicato.
  const documento = (draft ?? published) as Progetto | null
  const riferimenti = [documento?.cover, ...(documento?.photos ?? [])]
  const chiaveRiferimenti = riferimenti.map((r) => r?._ref ?? '').join(',')

  useEffect(() => {
    let annullato = false
    setBozze(null)

    const refs = riferimenti.filter(Boolean).map((r) => r!._ref)
    if (refs.length === 0) {
      setBozze([])
      return
    }

    async function cerca() {
      // `raw`: le bozze non esistono nella perspective predefinita, ed e
      // proprio delle bozze che questa azione deve parlare.
      const raw = client.withConfig({ perspective: 'raw' })

      const pubblicati = await raw.fetch<string[]>(`*[_id in $refs]._id`, { refs })
      const mancanti = riferimentiNonPubblicati(
        refs.map((_ref) => ({ _ref })),
        pubblicati ?? [],
      )

      if (mancanti.length === 0) {
        if (!annullato) setBozze([])
        return
      }

      const documenti = await raw.fetch<
        { _id: string; titleIt?: string; titleEn?: string; altIt?: string }[]
      >(`*[_id in $ids]{_id, titleIt, titleEn, altIt}`, { ids: mancanti.map(idBozza) })

      if (!annullato) setBozze((documenti ?? []).map(titoloDellaBozza))
    }

    cerca().catch(() => {
      // Un errore di rete non deve lasciare l'azione disabilitata per sempre:
      // meglio un elenco vuoto che un pulsante morto.
      if (!annullato) setBozze([])
    })

    return () => {
      annullato = true
    }
  }, [client, id, chiaveRiferimenti]) // eslint-disable-line react-hooks/exhaustive-deps

  const inVolo = bozze === null

  const quante = bozze?.length ?? 0

  return {
    label: inVolo ? 'Verifico le fotografie…' : `Fotografie in bozza (${quante})`,
    tone: quante > 0 ? 'caution' : undefined,
    // Disabilitata mentre la query e in volo: senza, c'e una frazione di
    // secondo in cui risulta abilitata e apre un dialog vuoto.
    disabled: inVolo,
    onHandle: () => setAperto(true),
    dialog: aperto && {
      type: 'dialog',
      header: 'Fotografie non ancora pubblicate',
      onClose: () => setAperto(false),
      content: (
        <Stack space={3}>
          <Text size={1}>{riepilogo(bozze?.length ?? 0)}</Text>

          {bozze && bozze.length > 0 ? (
            <Stack as="ul" space={2}>
              {bozze.map((b) => (
                <Text as="li" key={b.id} size={1}>
                  {b.titolo}
                </Text>
              ))}
            </Stack>
          ) : null}

          {bozze && bozze.length > 0 ? (
            <Text size={0} muted>
              Finche restano in bozza il progetto non si pubblica. Aprile dall elenco
              Fotografie, completa il testo alternativo e pubblicale.
            </Text>
          ) : null}
        </Stack>
      ),
    },
  }
}
