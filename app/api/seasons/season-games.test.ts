import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','orderBy','all']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','orderBy']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), asc: vi.fn() }))
vi.mock('@/db/schema', () => ({ games: {}, opponents: {} }))

import { GET } from '@/app/api/seasons/[id]/games/route'

const session = { user: { id: 'u1', role: 'admin' } }

describe('GET /api/seasons/[id]/games', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(res.status).toBe(401)
  })

  it('returns game rows with opponent names', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const rows = [
      { id: 'g1', date: '2026-04-01', opponentName: 'Diamond Devils', status: 'completed' },
      { id: 'g2', date: '2026-04-08', opponentName: 'Hillside Hawks', status: 'scheduled'  },
    ]
    mockDb.all.mockReturnValue(rows)
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].opponentName).toBe('Diamond Devils')
  })

  it('returns empty array when season has no games', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.all.mockReturnValue([])
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    const body = await res.json()
    expect(body).toEqual([])
  })
})
