'use client'

import { buildImageUrl } from './imageUrl'

export default function sanityImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return buildImageUrl(src, width, { quality: quality ?? 85 })
}
