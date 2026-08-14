import { definePlugin, type Tool } from 'sanity'
import { UploadTool } from './UploadTool'

/**
 * Il tool vive accanto ai contenuti, non dentro un tipo di documento: carica
 * piu file in una volta, e nessuno di essi esiste ancora come documento.
 */
export const uploadTool = (): Tool => ({
  name: 'carica-fotografie',
  title: 'Carica fotografie',
  component: UploadTool,
})

export const uploadToolPlugin = definePlugin({
  name: 'carica-fotografie',
  tools: (prev) => [...prev, uploadTool()],
})
