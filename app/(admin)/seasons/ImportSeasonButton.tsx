'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImportSeasonButton() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleButtonClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setLoading(true)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown

      const res = await fetch('/api/seasons/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })

      const data = await res.json() as { seasonId?: string; error?: string }

      if (res.ok && data.seasonId) {
        router.push(`/seasons/${data.seasonId}`)
      } else {
        setError(data.error ?? 'Import failed')
      }
    } catch {
      setError('Failed to read or parse file')
    } finally {
      setLoading(false)
      // Reset so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleButtonClick}
        disabled={loading}
      >
        {loading ? 'Importing…' : 'Import Season'}
      </button>
      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0' }}>{error}</p>
      )}
    </>
  )
}
