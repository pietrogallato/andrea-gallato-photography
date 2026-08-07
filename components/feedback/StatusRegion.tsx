export function StatusRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {message}
    </div>
  )
}
