'use client'

import { useState } from 'react'

function fmtDate(d: string, includeYear = false) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

export default function SeasonHeader({
  initialName,
  initialStartDate,
  initialEndDate,
  onSave,
}: {
  initialName:      string
  initialStartDate: string
  initialEndDate:   string
  onSave:           (name: string, startDate: string, endDate: string) => Promise<void>
}) {
  const [name,      setName]      = useState(initialName)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate,   setEndDate]   = useState(initialEndDate)

  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [draftName,  setDraftName]  = useState(initialName)
  const [draftStart, setDraftStart] = useState(initialStartDate)
  const [draftEnd,   setDraftEnd]   = useState(initialEndDate)

  function startEdit() {
    setDraftName(name)
    setDraftStart(startDate)
    setDraftEnd(endDate)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  async function save() {
    const trimmed = draftName.trim()
    if (!trimmed || !draftStart || !draftEnd) return
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed, draftStart, draftEnd)
      setName(trimmed)
      setStartDate(draftStart)
      setEndDate(draftEnd)
      setEditing(false)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <input
            type="text"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            autoFocus
            style={{
              fontSize: 22, fontWeight: 700, flex: 1, minWidth: 0,
              border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 10px',
            }}
          />
          <button onClick={save} disabled={saving} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={saving} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
            Cancel
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={draftStart}
            onChange={e => setDraftStart(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 6px', color: '#6b7280' }}
          />
          <span style={{ color: '#6b7280', fontSize: 14 }}>–</span>
          <input
            type="date"
            value={draftEnd}
            onChange={e => setDraftEnd(e.target.value)}
            style={{ fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 6px', color: '#6b7280' }}
          />
          {error && <span style={{ color: '#991b1b', fontSize: 12, marginLeft: 4 }}>{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{name}</h1>
        <button
          onClick={startEdit}
          title="Edit season"
          aria-label="Edit season"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', padding: 4, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', borderRadius: 4,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
        {fmtDate(startDate)}
        {' – '}
        {fmtDate(endDate, true)}
      </p>
    </div>
  )
}
