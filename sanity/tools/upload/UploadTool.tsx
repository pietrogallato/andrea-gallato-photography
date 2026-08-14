import { useCallback, useRef, useState } from 'react'
import { Badge, Box, Button, Card, Flex, Inline, Stack, Text } from '@sanity/ui'
import { useBatchUpload } from './useBatchUpload'
import { avanzamentoComplessivo, daRiprovare, esitoDelLotto, type FileDelLotto } from './uploadState'
import type { FileDaCaricare } from './eseguiLotto'

/**
 * Il tool «Carica fotografie».
 *
 * Rende soltanto lo stato: la logica sta in `eseguiLotto` e `uploadState`, che
 * sono verificabili senza uno Studio aperto.
 */

const ETICHETTA: Record<FileDelLotto['stato'], { testo: string; tono: 'default' | 'positive' | 'caution' | 'critical' }> = {
  'in-attesa': { testo: 'in attesa', tono: 'default' },
  caricamento: { testo: 'caricamento', tono: 'default' },
  creata: { testo: 'bozza creata', tono: 'positive' },
  duplicato: { testo: 'gia presente', tono: 'caution' },
  errore: { testo: 'errore', tono: 'critical' },
}

function Riga({ file }: { file: FileDelLotto }) {
  const etichetta = ETICHETTA[file.stato]

  return (
    <Card padding={3} radius={2} shadow={1}>
      <Flex align="center" gap={3}>
        <Box flex={1}>
          <Stack space={2}>
            <Text size={1} weight="medium" textOverflow="ellipsis">
              {file.nome}
            </Text>

            {file.stato === 'caricamento' ? (
              <Text size={0} muted>
                {file.percentuale}%
              </Text>
            ) : null}

            {file.errore ? (
              <Text size={0} muted>
                {file.errore}
              </Text>
            ) : null}

            {file.stato === 'duplicato' && file.documentoId ? (
              <Text size={0} muted>
                <a href={`/studio/intent/edit/id=${file.documentoId};type=photo`}>
                  Apri la fotografia gia caricata
                </a>
              </Text>
            ) : null}
          </Stack>
        </Box>

        <Badge tone={etichetta.tono}>{etichetta.testo}</Badge>
      </Flex>
    </Card>
  )
}

export function UploadTool() {
  const { stato, inCorso, carica, riprova, annulla } = useBatchUpload()
  const [scelti, setScelti] = useState<FileDaCaricare[]>([])
  const input = useRef<HTMLInputElement>(null)

  const onScelta = useCallback((elenco: FileList | null) => {
    const voci = Array.from(elenco ?? []).map((file) => ({ nome: file.name, file }))
    setScelti(voci)
    return voci
  }, [])

  const falliti = stato ? daRiprovare(stato) : []
  const esito = stato ? esitoDelLotto(stato) : null

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Stack space={3}>
          <Text size={2} weight="semibold">
            Carica fotografie
          </Text>
          <Text size={1} muted>
            Le fotografie entrano come bozze, spente in galleria. Restano da completare con il
            testo alternativo, poi si pubblicano.
          </Text>
          <Text size={0} muted>
            Un file gia caricato viene riconosciuto solo se identico: una riesportazione della
            stessa fotografia risulta nuova.
          </Text>
        </Stack>

        {/* L etichetta e esplicita e collegata: un input file senza nome
            accessibile viene annunciato come «pulsante», senza dire di che
            cosa. */}
        <Stack space={2}>
          <Text as="label" htmlFor="carica-fotografie-file" size={1} weight="medium">
            Scegli le fotografie
          </Text>
          <input
            id="carica-fotografie-file"
            ref={input}
            type="file"
            accept="image/*"
            multiple
            disabled={inCorso}
            onChange={(e) => {
              const voci = onScelta(e.target.files)
              if (voci.length > 0) void carica(voci)
            }}
          />
        </Stack>

        {stato ? (
          <Stack space={3}>
            <Flex align="center" gap={3}>
              <Box flex={1}>
                <Text size={1} muted>
                  {avanzamentoComplessivo(stato)}% — {stato.file.length} file
                </Text>
              </Box>

              {inCorso ? (
                <Button mode="ghost" text="Annulla" onClick={annulla} />
              ) : null}

              {!inCorso && falliti.length > 0 ? (
                <Button
                  tone="critical"
                  mode="ghost"
                  text={`Riprova i ${falliti.length} falliti`}
                  onClick={() => void riprova(scelti)}
                />
              ) : null}
            </Flex>

            <Stack space={2}>
              {stato.file.map((f) => (
                <Riga key={f.nome} file={f} />
              ))}
            </Stack>

            {esito === 'concluso' ? (
              <Text size={1}>Fatto. Le bozze sono nell elenco Fotografie.</Text>
            ) : null}

            {esito === 'concluso-con-errori' ? (
              <Inline space={2}>
                <Text size={1}>
                  Alcuni file non sono arrivati. Le bozze riuscite sono salve: il nuovo tentativo
                  riguarda solo i falliti.
                </Text>
              </Inline>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
