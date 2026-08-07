export const metadata = {
  title: 'Studio — Andrea Gallato',
  robots: { index: false, follow: false },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
