export const WIDTH_LADDER = [320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560, 3840] as const

const MAX_WIDTH = WIDTH_LADDER[WIDTH_LADDER.length - 1]

export function snapWidth(requested: number): number {
  const target = Math.ceil(requested)
  return WIDTH_LADDER.find((w) => w >= target) ?? MAX_WIDTH
}

/** Gli URL degli asset Sanity contengono le dimensioni native: `<id>-4000x3000.jpg`. */
export function parseAssetDimensions(src: string): { width: number; height: number } | null {
  const match = src.match(/-(\d+)x(\d+)\.\w+/)
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}

export type ImageUrlOptions = {
  quality?: number
  /** Fissa il formato invece di negoziarlo. Per i crawler, che non mandano Accept. */
  format?: 'jpg' | 'png' | 'webp'
}

export function buildImageUrl(src: string, width: number, options: ImageUrlOptions = {}): string {
  const native = parseAssetDimensions(src)
  const capped = native ? Math.min(snapWidth(width), native.width) : snapWidth(width)
  const finalWidth = snapWidth(capped)

  const url = new URL(src)
  url.searchParams.set('w', String(finalWidth))
  url.searchParams.set('fit', 'max')

  if (options.format) {
    url.searchParams.set('fm', options.format)
  } else {
    url.searchParams.set('auto', 'format')
  }

  if (options.quality) url.searchParams.set('q', String(options.quality))

  return url.toString()
}
