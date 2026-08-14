import type { NextConfig } from 'next'
import { clearPersistedFetchCache } from './scripts/build/fetchCache'

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/', destination: '/it', permanent: true },
  ],
  images: {
    loader: 'custom',
    loaderFile: './lib/sanity/imageLoader.ts',
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560, 3840],
    imageSizes: [320, 480],
  },
}

/**
 * La configurazione e una funzione della fase per un solo motivo: eliminare,
 * prima di ogni build di produzione, la cache dei fetch lasciata dal build
 * precedente. Senza, il build renderizza dati stantii — vedi il commento di
 * `clearPersistedFetchCache` per il meccanismo.
 *
 * Il caricamento della configurazione precede la generazione delle pagine e
 * avviene qualunque sia il comando che ha avviato il build, che e la ragione
 * per cui la pulizia sta qui e non in uno script di npm.
 */
export default function config(phase: string): NextConfig {
  const removed = clearPersistedFetchCache({ phase, distDir: nextConfig.distDir })
  if (removed) console.log(`- Cache dei fetch rimossa (${removed}): il build rilegge Sanity`)

  return nextConfig
}
