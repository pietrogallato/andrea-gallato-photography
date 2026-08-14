import { useCallback, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'
import type { SanityClient } from '@sanity/client'
import { findDuplicatePhoto } from './dedupe'
import { nextOrderRank } from '../../lib/orderRank'
import { eseguiLotto, statoIniziale, type FileDaCaricare, type PortaCaricamento } from './eseguiLotto'
import { daRiprovare, type StatoLotto } from './uploadState'

const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2024-01-01'

type Annullabile = { unsubscribe: () => void }

/**
 * Carica l'asset riportando l'avanzamento.
 *
 * **`client.observable.assets.upload`, non `client.assets.upload`.** La
 * seconda restituisce una Promise e basta: nessun evento di avanzamento,
 * quindi nessuna barra di progresso possibile. L'`unsubscribe` e anche il
 * modo di annullare un trasferimento in volo.
 */
function caricaAsset(
  client: SanityClient,
  registra: (s: Annullabile) => void,
  voce: FileDaCaricare,
  onAvanzamento: (percentuale: number) => void,
): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const sottoscrizione = client.observable.assets
      .upload('image', voce.file, { filename: voce.nome })
      .subscribe({
        next: (evento: { type: string; percent?: number; body?: { document: { _id: string } } }) => {
          if (evento.type === 'progress') onAvanzamento(evento.percent ?? 0)
          if (evento.type === 'response' && evento.body) risolvi(evento.body.document._id)
        },
        error: rifiuta,
      })

    registra(sottoscrizione)
  })
}

export function useBatchUpload() {
  const client = useClient({ apiVersion: API_VERSION })
  const [stato, setStato] = useState<StatoLotto | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const sottoscrizioni = useRef<Annullabile[]>([])

  const porta = useMemo<PortaCaricamento>(
    () => ({
      caricaAsset: (voce, onAvanzamento) =>
        caricaAsset(client, (s) => sottoscrizioni.current.push(s), voce, onAvanzamento),

      trovaDuplicato: (assetId) => findDuplicatePhoto(client, assetId),

      prossimoRank: () => nextOrderRank(client, 'photo'),

      creaBozza: async ({ assetId, orderRank }) => {
        // Nasce **bozza** e **fuori dalla galleria**: il tool porta dentro i
        // file, non decide cosa il pubblico vede. Il testo alternativo lo
        // scrive l'editor, ed e la validazione della pubblicazione a
        // pretenderlo.
        const creato = await client.create({
          _id: `drafts.${crypto.randomUUID()}`,
          _type: 'photo',
          image: { _type: 'image', asset: { _type: 'reference', _ref: assetId } },
          showInGallery: false,
          orderRank,
        })
        return creato._id
      },
    }),
    [client],
  )

  const esegui = useCallback(
    async (files: FileDaCaricare[], precedente?: StatoLotto) => {
      if (files.length === 0) return

      sottoscrizioni.current = []
      setStato(statoIniziale(files, precedente))
      setInCorso(true)

      try {
        await eseguiLotto(files, porta, (trasforma) =>
          setStato((s) => (s ? trasforma(s) : s)),
        )
      } finally {
        setInCorso(false)
        sottoscrizioni.current = []
      }
    },
    [porta],
  )

  const carica = useCallback((files: FileDaCaricare[]) => esegui(files), [esegui])

  /** Riprende **solo** i falliti, conservando le bozze gia create. */
  const riprova = useCallback(
    (tutti: FileDaCaricare[]) => {
      if (!stato) return
      const nomi = new Set(daRiprovare(stato))
      return esegui(
        tutti.filter((f) => nomi.has(f.nome)),
        stato,
      )
    },
    [esegui, stato],
  )

  const annulla = useCallback(() => {
    for (const s of sottoscrizioni.current) s.unsubscribe()
    sottoscrizioni.current = []
  }, [])

  return { stato, inCorso, carica, riprova, annulla }
}
