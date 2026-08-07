'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-7) var(--space-4)' }}>
      <h1>Errore — Error</h1>
      <p style={{ marginTop: 'var(--space-3)', color: 'var(--fg-muted)' }}>
        Qualcosa non ha funzionato — Something went wrong.
      </p>
      <button type="button" onClick={reset} style={{ marginTop: 'var(--space-4)', textDecoration: 'underline' }}>
        Riprova — Try again
      </button>
    </div>
  )
}
