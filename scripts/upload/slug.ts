import path from 'node:path'

/**
 * `The Wall.jpg` -> `the-wall`.
 *
 * Deterministico di proposito: l'`_id` del documento ne deriva, ed e cio che
 * rende il caricamento rieseguibile senza duplicare nulla.
 */
export function slugForFilename(filename: string): string {
  return path
    .parse(filename)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
