import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { players } from '@/db/schema'
import PositionCheckboxes from '@/components/PositionCheckboxes'
import type { Position } from '@/db/schema'

export default async function PlayerPage({ params }: { params: { id: string } }) {
  await requireSession()

  const playerRow = await db.select().from(players).where(eq(players.id, params.id)).get()
  if (!playerRow) notFound()
  const player = playerRow

  const headersList = headers()
  const host  = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const availabilityUrl = `${proto}://${host}/availability/${player.availabilityToken}`

  async function updatePlayer(data: FormData) {
    'use server'
    const name         = (data.get('name')         as string).trim()
    const jerseyNumber = (data.get('jerseyNumber') as string)?.trim() || null
    if (!name) return

    await db.update(players).set({
      name,
      jerseyNumber,
      preferredPositions: data.getAll('preferredPositions') as Position[],
      phone:    (data.get('phone')    as string)?.trim() || null,
      email:    (data.get('email')    as string)?.trim() || null,
      whatsapp: (data.get('whatsapp') as string)?.trim() || null,
      notes:    (data.get('notes')    as string)?.trim() || null,
      updatedAt: new Date(),
    }).where(eq(players.id, params.id)).run()

    revalidatePath(`/roster/${params.id}`)
    revalidatePath('/roster')
    redirect('/roster')
  }

  async function toggleActive() {
    'use server'
    await db.update(players).set({ isActive: !player.isActive, updatedAt: new Date() })
      .where(eq(players.id, params.id)).run()
    revalidatePath(`/roster/${params.id}`)
    revalidatePath('/roster')
    redirect('/roster')
  }

  async function resetToken() {
    'use server'
    await db.update(players).set({ availabilityToken: randomUUID(), updatedAt: new Date() })
      .where(eq(players.id, params.id)).run()
    revalidatePath(`/roster/${params.id}`)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/roster" style={{ color: '#6b7280', fontSize: 14 }}>← Roster</Link>
        <h1 style={{ margin: 0 }}>
          {player.name}
          {!player.isActive && <span className="badge badge-gray" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Inactive</span>}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* Edit form */}
        <div className="card">
          <h2>Player Details</h2>
          <form action={updatePlayer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="name">Name *</label>
                <input id="name" name="name" type="text" required defaultValue={player.name} />
              </div>
              <div className="field">
                <label htmlFor="jerseyNumber">Jersey #</label>
                <input id="jerseyNumber" name="jerseyNumber" type="text" defaultValue={player.jerseyNumber ?? ''} style={{ minWidth: 80, maxWidth: 100 }} />
              </div>
            </div>

            <div className="field">
              <label>Preferred Positions</label>
              <PositionCheckboxes selected={player.preferredPositions} />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" defaultValue={player.phone ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" defaultValue={player.email ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="whatsapp">WhatsApp</label>
                <input id="whatsapp" name="whatsapp" type="tel" defaultValue={player.whatsapp ?? ''} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" rows={3} defaultValue={player.notes ?? ''} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary">Save Changes</button>
              <Link href="/roster" className="btn btn-secondary">Cancel</Link>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Availability link */}
          <div className="card">
            <h2>Availability Link</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
              Share this link with {player.name.split(' ')[0]} so they can set their availability.
            </p>
            <code style={{ display: 'block', fontSize: 12, background: '#f3f4f6', padding: '8px 10px', borderRadius: 6, wordBreak: 'break-all', marginBottom: 10 }}>
              {availabilityUrl}
            </code>
            <form action={resetToken}>
              <button type="submit" className="btn btn-secondary btn-sm">Reset Link</button>
            </form>
          </div>

          {/* Activate / Deactivate */}
          <div className="card">
            <h2>{player.isActive ? 'Deactivate Player' : 'Reactivate Player'}</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              {player.isActive
                ? 'Inactive players are hidden from the roster and cannot be added to game lineups.'
                : 'Reactivating will make this player visible on the roster again.'}
            </p>
            <form action={toggleActive}>
              <button
                type="submit"
                className={`btn btn-sm ${player.isActive ? 'btn-danger' : 'btn-secondary'}`}
              >
                {player.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
