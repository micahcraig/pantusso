import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockCreateGameWithRoster = vi.hoisted(() => vi.fn())
vi.mock('@/lib/games', () => ({ createGameWithRoster: mockCreateGameWithRoster }))

import { POST } from '@/app/api/games/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

const validBody = {
  seasonId:   's1',
  opponentId: 'o1',
  date:       '2026-06-01',
  time:       '18:30',
  location:   'Field 1',
  homeOrAway: 'home',
}

function makePost(body: unknown) {
  return new Request('http://localhost/api/games', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('POST /api/games', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await POST(makePost(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const { seasonId: _omit, ...missing } = validBody
    const res = await POST(makePost(missing))
    expect(res.status).toBe(400)
  })

  it('calls createGameWithRoster with scheduled status', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const game = { id: 'g1', ...validBody, status: 'scheduled', ourScore: null, opponentScore: null }
    mockCreateGameWithRoster.mockResolvedValue(game)

    const res = await POST(makePost(validBody))
    expect(res.status).toBe(201)
    expect(mockCreateGameWithRoster).toHaveBeenCalledWith(expect.objectContaining({
      seasonId:   's1',
      opponentId: 'o1',
      status:     'scheduled',
      ourScore:   null,
      opponentScore: null,
    }))
  })

  it('returns the created game', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const game = { id: 'g1', ...validBody, status: 'scheduled', ourScore: null, opponentScore: null }
    mockCreateGameWithRoster.mockResolvedValue(game)

    const res = await POST(makePost(validBody))
    const body = await res.json()
    expect(body.id).toBe('g1')
    expect(body.status).toBe('scheduled')
  })
})
