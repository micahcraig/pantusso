import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','delete','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','delete']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), inArray: vi.fn() }))
vi.mock('@/db/schema', () => ({ seasonRoster: {}, games: {}, gamePlayers: {} }))

import { DELETE } from '@/app/api/seasons/[id]/roster/[playerId]/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

const params = { id: 's1', playerId: 'p1' }

describe('DELETE /api/seasons/[id]/roster/[playerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.delete.mockReturnValue(mockDb)
    mockDb.select.mockReturnValue(mockDb)
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await DELETE(new Request('http://localhost'), { params })
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await DELETE(new Request('http://localhost'), { params })
    expect(res.status).toBe(403)
  })

  it('deletes the roster entry', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    await DELETE(new Request('http://localhost'), { params })
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it('returns ok: true on success', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    const res = await DELETE(new Request('http://localhost'), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('cleans up unknown game_players from scheduled games', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([{ id: 'g1' }, { id: 'g2' }])
    await DELETE(new Request('http://localhost'), { params })
    // delete called twice: once for roster, once for game_players
    expect(mockDb.delete).toHaveBeenCalledTimes(2)
  })

  it('does not call second delete when no scheduled games exist', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([]) // no scheduled games
    await DELETE(new Request('http://localhost'), { params })
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })
})
