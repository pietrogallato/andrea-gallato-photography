export function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ color: 'var(--fg-muted)', padding: 'var(--space-6) var(--space-4)' }}>
      {message}
    </p>
  )
}
