'use client'

import { useState } from 'react'

export default function ChangePasswordForm() {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/account/password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setLoading(false)

    if (res.ok) {
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2 style={{ marginTop: 0 }}>Change Password</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label htmlFor="current">Current password</label>
          <input
            id="current"
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label htmlFor="next">New password</label>
          <input
            id="next"
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error   && <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>}
        {success && <p style={{ color: '#16a34a', fontSize: 14, margin: 0 }}>Password updated successfully.</p>}
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
