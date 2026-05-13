'use client'

import { useRef, useState } from 'react'
import PositionCheckboxes from '@/components/PositionCheckboxes'

export default function AddRingerForm({
  addRinger,
}: {
  addRinger: (data: FormData) => Promise<void>
}) {
  const formRef     = useRef<HTMLFormElement>(null)
  const [name, setName]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setSubmitting(true)
    try {
      await addRinger(new FormData(formRef.current))
      formRef.current.reset()
      setName('')
      setToast(true)
      setTimeout(() => setToast(false), 3500)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ringer-name">Name *</label>
            <input
              id="ringer-name"
              name="name"
              type="text"
              required
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ringer-jersey">Jersey #</label>
            <input id="ringer-jersey" name="jerseyNumber" type="text" placeholder="e.g. 12" style={{ minWidth: 80, maxWidth: 100 }} />
          </div>
        </div>

        <div className="field">
          <label>Preferred Positions</label>
          <PositionCheckboxes />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="ringer-phone">Phone</label>
            <input id="ringer-phone" name="phone" type="tel" placeholder="555-0100" />
          </div>
          <div className="field">
            <label htmlFor="ringer-email">Email</label>
            <input id="ringer-email" name="email" type="email" placeholder="player@example.com" />
          </div>
          <div className="field">
            <label htmlFor="ringer-whatsapp">WhatsApp</label>
            <input id="ringer-whatsapp" name="whatsapp" type="tel" placeholder="Optional" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ringer-notes">Notes</label>
          <textarea id="ringer-notes" name="notes" rows={2} placeholder="Any notes about this player" style={{ resize: 'vertical' }} />
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || submitting}
          >
            {submitting ? 'Adding…' : 'Add Ringer'}
          </button>
        </div>
      </form>

      {toast && (
        <div style={{
          position:     'fixed',
          bottom:        24,
          right:         24,
          background:    '#166534',
          color:         'white',
          padding:       '10px 18px',
          borderRadius:  8,
          fontSize:      14,
          fontWeight:    500,
          boxShadow:     '0 4px 12px rgba(0,0,0,0.15)',
          zIndex:        50,
        }}>
          Ringer added successfully
        </div>
      )}
    </>
  )
}
