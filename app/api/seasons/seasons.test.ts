import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockRandomUUID = vi.hoisted(() => vi.fn().mockReturnValue('new-season-id'))
vi.mock('crypto', () => ({ randomUUID: mockRandomUUID }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','orderBy','insert','values','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','orderBy','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ desc: vi.fn() }))
vi.mock('@/db/schema', () => ({ seasons: {} }))

import { GET, POST } from '@/app/api/seasons/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

function makePost(body: unknown) {
  return new Request('http://localhost/api/seasons', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/seasons', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns all seasons ordered by startDate', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const rows = [{ id: 's1', name: 'Spring 2026' }]
    mockDb.all.mockReturnValue(rows)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(rows)
  })

  it('allows manager to list seasons', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.all.mockReturnValue([])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/seasons', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.insert.mockReturnValue(mockDb); mockDb.values.mockReturnValue(mockDb) })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost({ name: 'Fall', startDate: '2026-09-01', endDate: '2026-11-30' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await POST(makePost({ name: 'Fall', startDate: '2026-09-01', endDate: '2026-11-30' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ startDate: '2026-09-01', endDate: '2026-11-30' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when startDate is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ name: 'Fall', endDate: '2026-11-30' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when endDate is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ name: 'Fall', startDate: '2026-09-01' }))
    expect(res.status).toBe(400)
  })

  it('creates season and returns 201', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ name: 'Fall 2026', startDate: '2026-09-01', endDate: '2026-11-30' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-season-id')
    expect(body.name).toBe('Fall 2026')
    expect(body.startDate).toBe('2026-09-01')
    expect(body.endDate).toBe('2026-11-30')
  })
})
