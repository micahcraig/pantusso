import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { players } from '@/db/schema'
import { eq } from 'drizzle-orm'
import PositionCheckboxes from '@/components/PositionCheckboxes'
import type { Position } from '@/db/schema'

export default async function RosterPage() {
  await requireSession()

  const allPlayers = await db.select().from(players).all()
  const active   = allPlayers.filter(p =>  p.isActive).sort((a, b) => +a.jerseyNumber - +b.jerseyNumber)
  const inactive = allPlayers.filter(p => !p.isActive).sort((a, b) => +a.jerseyNumber - +b.jerseyNumber)

  async function createPlayer(data: FormData) {
    'use server'
    const name         = (data.get('name')         as string).trim()
    const jerseyNumber = (data.get('jerseyNumber') as string).trim()
    if (!name || !jerseyNumber) return

    const preferredPositions = data.getAll('preferredPositions') as Position[]
    const phone    = (data.get('phone')    as string)?.trim() || null
    const email    = (data.get('email')    as string)?.trim() || null
    const whatsapp = (data.get('whatsapp') as string)?.trim() || null
    const notes    = (data.get('notes')    as string)?.trim() || null

    const id = randomUUID()
    await db.insert(players).values({
      id, name, jerseyNumber, preferredPositions,
      phone, email, whatsapp, notes,
      isActive:  true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run()

    revalidatePath('/roster')
    redirect(`/roster/${id}`)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Roster</h1>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{active.length} active player{active.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Active players */}
      <div className="card mb-4">
        {active.length === 0 && (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No active players</p>
        )}
        {active.map((p, i) => (
          <Link
            key={p.id}
            href={`/roster/${p.id}`}
            className="list-row"
            style={{ borderBottom: i < active.length - 1 ? '1px solid #e5e7eb' : 'none' }}
          >
            <span style={{ width: 32, flexShrink: 0, fontWeight: 600, color: '#9ca3af', fontSize: 13 }}>
              #{p.jerseyNumber}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
              {p.notes && (
                <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.notes.slice(0, 60)}{p.notes.length > 60 ? '…' : ''}
                </span>
              )}
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
              {p.preferredPositions.map(pos => (
                <span key={pos} className="badge badge-blue">{pos}</span>
              ))}
            </span>
          </Link>
        ))}
      </div>

      {/* Inactive players */}
      {inactive.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
            {inactive.length} inactive player{inactive.length !== 1 ? 's' : ''}
          </summary>
          <div className="card mt-4">
            {inactive.map((p, i) => (
              <Link
                key={p.id}
                href={`/roster/${p.id}`}
                className="list-row"
                style={{ borderBottom: i < inactive.length - 1 ? '1px solid #e5e7eb' : 'none', opacity: 0.6 }}
              >
                <span style={{ width: 32, flexShrink: 0, fontWeight: 600, color: '#9ca3af', fontSize: 13 }}>
                  #{p.jerseyNumber}
                </span>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.name}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                  {p.preferredPositions.map(pos => (
                    <span key={pos} className="badge badge-gray">{pos}</span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}

      {/* Add player */}
      <details className="card mt-4">
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>+ Add Player</summary>
        <form action={createPlayer} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="name">Name *</label>
              <input id="name" name="name" type="text" required placeholder="Full name" />
            </div>
            <div className="field">
              <label htmlFor="jerseyNumber">Jersey # *</label>
              <input id="jerseyNumber" name="jerseyNumber" type="text" required placeholder="e.g. 12" style={{ minWidth: 80, maxWidth: 100 }} />
            </div>
          </div>

          <div className="field">
            <label>Preferred Positions</label>
            <PositionCheckboxes />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" placeholder="555-0100" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="player@example.com" />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" type="tel" placeholder="Optional" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} placeholder="Any notes about this player" style={{ resize: 'vertical' }} />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">Add Player</button>
          </div>
        </form>
      </details>
    </>
  )
}
