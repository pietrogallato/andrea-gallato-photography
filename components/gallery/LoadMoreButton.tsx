'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { StatusRegion } from '@/components/feedback/StatusRegion'
import styles from './LoadMoreButton.module.css'

export function LoadMoreButton({
  hasMore,
  loading,
  error,
  dict,
  onLoad,
}: {
  hasMore: boolean
  loading: boolean
  error: boolean
  dict: Dictionary
  onLoad: () => void
}) {
  const message = loading ? dict.loading : error ? dict.errorGeneric : ''

  if (!hasMore) return <StatusRegion message={message} />

  return (
    <div className={styles.wrapper}>
      <StatusRegion message={message} />

      {error ? (
        <button type="button" className={styles.button} onClick={onLoad}>
          {dict.retry}
        </button>
      ) : (
        <button
          type="button"
          className={styles.button}
          aria-disabled={loading || undefined}
          onClick={() => {
            if (!loading) onLoad()
          }}
        >
          {dict.loadMore}
        </button>
      )}
    </div>
  )
}
