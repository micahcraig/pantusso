import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockRandomUUID = vi.hoisted(() => vi.fn().mockReturnValue('new-id'))
vi.mock('crypto', () => ({ randomUUID: mockRandomUUID }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','orderBy','insert','values','get','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','orderBy','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ asc: vi.fn() }))
vi.mock('@/db/schema', () => ({ opponents: {} }))

import { GET, POST } from '@/app/api/opponents/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

describe('GET /api/opponents', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns all opponents when authenticated', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const rows = [{ id: 'o1', name: 'Diamond Devils' }]
    mockDb.all.mockReturnValue(rows)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(rows)
  })

  it('allows manager to list opponents', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.all.mockReturnValue([])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/opponents', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.insert.mockReturnValue(mockDb); mockDb.values.mockReturnValue(mockDb) })

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/opponents', {
      method: 'POST',
      body:   JSON.stringify(body),
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('allows manager to create opponent', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makeRequest({ name: 'Test Team' }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makeRequest({ notes: 'some notes' }))
    expect(res.status).toBe(400)
  })

  it('creates opponent and returns 201', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makeRequest({ name: 'River Rats', notes: 'Field 5' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-id')
    expect(body.name).toBe('River Rats')
    expect(body.notes).toBe('Field 5')
  })

  it('defaults notes to null when not provided', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makeRequest({ name: 'Lone Wolves' }))
    const body = await res.json()
    expect(body.notes).toBeNull()
  })
})
