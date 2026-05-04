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
      className="btn btn-secondary btn-sm"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? 'Exporting…' : 'Export JSON'}
    </button>
  )
}
