import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite risolve nativamente i paths di tsconfig; il plugin
    // vite-tsconfig-paths e deprecato da Vitest 4.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    // I worktree delle attivita in background vivono in `.claude/worktrees/`,
    // cioe dentro il repository: senza questa riga ogni copia del progetto
    // porta con se un'altra copia dei test, e il conto triplica. Peggio: i
    // fallimenti di un'altra copia sembrano nostri.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/**'],
  },
})
