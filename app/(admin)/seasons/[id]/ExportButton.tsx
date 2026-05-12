'use client'

import { useState } from 'react'

type Props = {
  seasonId: string
  seasonName: string
}

export default function ExportButton({ seasonId, seasonName }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/export`)
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json() as unknown
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = seasonName.toLowerCase().replace(/\s+/g, '-') + '.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      title="Export JSON"
      aria-label="Export JSON"
      style={{
        background: 'none',
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        color: loading ? '#d1d5db' : '#9ca3af',
        padding: 4,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 4,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
  )
}
