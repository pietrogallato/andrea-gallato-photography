import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'xpdypayk',
    dataset: 'production',
  },
  typegen: {
    path: [
      './lib/**/*.ts',
      './app/**/*.{ts,tsx}',
      './views/**/*.tsx',
      './components/**/*.tsx',
    ],
    schema: './schema.json',
    generates: './lib/sanity/types.generated.ts',
  },
})
