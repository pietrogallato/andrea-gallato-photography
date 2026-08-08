import { Bodoni_Moda, Inter } from 'next/font/google'

/**
 * Coppia tipografica del sito.
 *
 * Bodoni Moda per i titoli: e la didone dei titoli di testa e dell editoria di
 * moda, con un contrasto di tratto altissimo che su fondo quasi nero produce
 * l effetto filmico voluto dalla specifica 7 senza aggiungere un solo elemento
 * decorativo. Fragile ai corpi piccoli, quindi resta ai soli titoli.
 *
 * Inter per interfaccia e testo corrente: neutra, disegnata per gli schermi,
 * legibile a 12px. Usata in maiuscoletto spaziato per etichette e navigazione,
 * dove richiama i cartelli di coda di un film restando discreta.
 *
 * next/font scarica e serve i file dal nostro dominio a build time: nessuna
 * richiesta a terzi a runtime e nessuno spostamento di layout all arrivo del
 * font, perche le metriche di ripiego sono calcolate in anticipo.
 */

export const display = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})

export const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-loaded',
})
