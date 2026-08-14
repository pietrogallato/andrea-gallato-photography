import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemas'
import { deskStructure, SINGLETON_TYPES } from './sanity/structure/deskStructure'
import { uploadToolPlugin } from './sanity/tools/upload'
import { reportBozzeAction } from './sanity/actions/reportBozze'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!

export default defineConfig({
  name: 'default',
  title: 'Andrea Gallato',
  basePath: '/studio',
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    // I singleton non compaiono nel menu "crea nuovo"
    templates: (prev) => prev.filter((t) => !SINGLETON_TYPES.has(t.schemaType)),
  },
  document: {
    actions: (prev, { schemaType }) => {
      // I singleton non sono duplicabili né eliminabili
      const base = SINGLETON_TYPES.has(schemaType)
        ? prev.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : prev

      // Si **aggiunge** alle azioni esistenti: sostituirle toglierebbe
      // Publish, ed e il pulsante per cui esiste tutto il resto.
      return schemaType === 'project' ? [...base, reportBozzeAction] : base
    },
  },
  plugins: [
    structureTool({ structure: deskStructure }),
    uploadToolPlugin(),
    ...(process.env.NODE_ENV === 'development' ? [visionTool()] : []),
  ],
})
