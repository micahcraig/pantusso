import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { seasons } from '@/db/schema'
import ImportSeasonButton from './ImportSeasonButton'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function SeasonsPage() {
  const session = await requireSession()
  const isAdmin = session.user.role === 'admin'

  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.startDate)).all()

  async function createSeason(data: FormData) {
    'use server'
    const name      = (data.get('name')      as string).trim()
    const startDate = (data.get('startDate') as string).trim()
    const endDate   = (data.get('endDate')   as string).trim()
    if (!name || !startDate || !endDate) return

    const id = randomUUID()
    await db.insert(seasons).values({
      id, name, startDate, endDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run()

    revalidatePath('/seasons')
    redirect(`/seasons/${id}`)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Seasons</h1>
        {isAdmin && <ImportSeasonButton />}
      </div>

      <div className="card">
        {allSeasons.length === 0 && (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No seasons yet. Create one below.</p>
        )}
        {allSeasons.map((s, i) => (
          <Link
            key={s.id}
            href={`/seasons/${s.id}`}
            className="list-row"
            style={{ borderBottom: i < allSeasons.length - 1 ? '1px solid #e5e7eb' : 'none' }}
          >
            <span style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</span>
            <span style={{ color: '#6b7280', fontSize: 13 }}>{fmtDate(s.startDate)} – {fmtDate(s.endDate)}</span>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <details className="card mt-4">
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>+ New Season</summary>
          <form action={createSeason} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="name">Season Name *</label>
                <input id="name" name="name" type="text" required placeholder="e.g. Spring 2026" />
              </div>
              <div className="field">
                <label htmlFor="startDate">Start Date *</label>
                <input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="endDate">End Date *</label>
                <input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn-primary">Create Season</button>
            </div>
          </form>
        </details>
      )}
    </>
  )
}
