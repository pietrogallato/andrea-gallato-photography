import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const ASPECT_RATIOS = [
  { name: '16-9', ratio: 16 / 9 },
  { name: '3-2', ratio: 3 / 2 },
  { name: '1-1', ratio: 1 },
  { name: '4-5', ratio: 4 / 5 },
  { name: '2-3', ratio: 2 / 3 },
] as const

export const MAX_LONG_EDGE = 4000

export type PlaceholderSpec = {
  filename: string
  ratioName: string
  ratio: number
  width: number
  height: number
  hue: number
}

export function buildPlaceholderPlan(count: number): PlaceholderSpec[] {
  const plan: PlaceholderSpec[] = []

  for (let i = 0; i < count; i++) {
    const { name, ratio } = ASPECT_RATIOS[i % ASPECT_RATIOS.length]

    // Lato lungo variabile ma deterministico, entro il limite operativo.
    const longEdge = 2400 + ((i * 317) % (MAX_LONG_EDGE - 2400))

    const width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio)
    const height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge

    plan.push({
      filename: `placeholder-${String(i + 1).padStart(3, '0')}-${name}.jpg`,
      ratioName: name,
      ratio,
      width,
      height,
      hue: (i * 37) % 360,
    })
  }

  return plan
}

export const OUTPUT_DIR = path.join(process.cwd(), 'scripts/seed/generated')

export async function generatePlaceholders(count: number): Promise<string[]> {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const plan = buildPlaceholderPlan(count)
  const written: string[] = []

  for (const spec of plan) {
    const buffer = await sharp({
      create: {
        width: spec.width,
        height: spec.height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: spec.width,
              height: spec.height,
              channels: 3,
              background: hslToRgb(spec.hue, 0.18, 0.32),
            },
          },
          blend: 'over',
        },
      ])
      .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
      .withMetadata({ icc: 'srgb' })
      .toBuffer()

    const filePath = path.join(OUTPUT_DIR, spec.filename)
    await writeFile(filePath, buffer)
    written.push(filePath)
  }

  return written
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x]

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}
