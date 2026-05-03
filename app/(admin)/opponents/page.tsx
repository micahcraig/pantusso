import { revalidatePath } from 'next/cache'
import { eq, asc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/session'
import { db } from '@/db'
import { opponents } from '@/db/schema'

export default async function OpponentsPage() {
  await requireAdmin()

  const allOpponents = await db.select().from(opponents).orderBy(asc(opponents.name)).all()

  async function createOpponent(data: FormData) {
    'use server'
    const name  = (data.get('name')  as string).trim()
    const notes = (data.get('notes') as string)?.trim() || null
    if (!name) return
    await db.insert(opponents).values({ name, notes, createdAt: new Date(), updatedAt: new Date() }).run()
    revalidatePath('/opponents')
  }

  async function updateOpponent(data: FormData) {
    'use server'
    const id    = data.get('id')    as string
    const name  = (data.get('name')  as string).trim()
    const notes = (data.get('notes') as string)?.trim() || null
    if (!id || !name) return
    await db.update(opponents).set({ name, notes, updatedAt: new Date() }).where(eq(opponents.id, id)).run()
    revalidatePath('/opponents')
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Opponents</h1>
      </div>

      <div className="card">
        {allOpponents.length === 0 && (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No opponents yet.</p>
        )}
        {allOpponents.map((o, i) => (
          <details key={o.id} className="opponent-row" style={{ borderBottom: i < allOpponents.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{o.name}</span>
              {o.notes && <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes}</span>}
            </summary>
            <form action={updateOpponent} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="id" value={o.id} />
              <div className="field">
                <label>Team Name</label>
                <input name="name" type="text" required defaultValue={o.name} />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea name="notes" rows={2} defaultValue={o.notes ?? ''} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
              </div>
            </form>
          </details>
        ))}
      </div>

      <details className="card mt-4">
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>+ Add Opponent</summary>
        <form action={createOpponent} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="new-name">Team Name *</label>
              <input id="new-name" name="name" type="text" required placeholder="e.g. Diamond Devils" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-notes">Notes</label>
            <textarea id="new-notes" name="notes" rows={2} placeholder="Home field, rivalry notes, etc." style={{ resize: 'vertical' }} />
          </div>
          <div>
            <button type="submit" className="btn btn-primary">Add Opponent</button>
          </div>
        </form>
      </details>
    </>
  )
}
