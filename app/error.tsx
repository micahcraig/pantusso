'use client'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button className="btn btn-primary" onClick={reset}>Try again</button>
      </div>
    </div>
  )
}
