import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockRandomUUID = vi.hoisted(() => vi.fn().mockReturnValue('new-player-id'))
vi.mock('crypto', () => ({ randomUUID: mockRandomUUID }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','insert','values','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({ players: {} }))

import { GET, POST } from '@/app/api/roster/route'

const session = { user: { id: 'u1', role: 'admin' } }

function makePost(body: unknown) {
  return new Request('http://localhost/api/roster', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/roster', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns active players', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const rows = [{ id: 'p1', name: 'Alice', isActive: true }]
    mockDb.all.mockReturnValue(rows)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(rows)
  })
})

describe('POST /api/roster', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.insert.mockReturnValue(mockDb); mockDb.values.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost({ name: 'Alice', jerseyNumber: '7' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await POST(makePost({ jerseyNumber: '7' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when jerseyNumber is missing', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await POST(makePost({ name: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('creates player and returns 201', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ name: 'Alice', jerseyNumber: '7' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-player-id')
    expect(body.name).toBe('Alice')
    expect(body.jerseyNumber).toBe('7')
    expect(body.isActive).toBe(true)
  })

  it('defaults optional fields to null', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ name: 'Bob', jerseyNumber: '3' }))
    const body = await res.json()
    expect(body.phone).toBeNull()
    expect(body.email).toBeNull()
    expect(body.notes).toBeNull()
    expect(body.preferredPositions).toEqual([])
  })

  it('accepts optional fields when provided', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({
      name: 'Carol', jerseyNumber: '9',
      phone: '555-1234', email: 'carol@example.com',
      preferredPositions: ['P', 'SS'],
    }))
    const body = await res.json()
    expect(body.phone).toBe('555-1234')
    expect(body.email).toBe('carol@example.com')
    expect(body.preferredPositions).toEqual(['P', 'SS'])
  })
})
