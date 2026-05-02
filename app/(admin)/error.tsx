'use client'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 16px' }}>
      <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  )
}
