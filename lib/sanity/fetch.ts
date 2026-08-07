import type { QueryParams } from '@sanity/client'
import { publicClient } from './client'

export async function sanityFetch<const Q extends string>({
  query,
  params = {},
  tags = [],
}: {
  query: Q
  params?: QueryParams
  tags?: string[]
}) {
  return publicClient.fetch(query, params, {
    cache: 'force-cache',
    next: { tags, revalidate: false },
  })
}
