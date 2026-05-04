import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockCompareSync = vi.hoisted(() => vi.fn())
const mockHashSync    = vi.hoisted(() => vi.fn().mockReturnValue('new-hash'))
vi.mock('bcryptjs', () => ({ default: { compareSync: mockCompareSync, hashSync: mockHashSync } }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','update','set','get','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','update','set']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({ users: {} }))

import { POST } from '@/app/api/account/password/route'

const session = { user: { id: 'u1', role: 'admin' } }
const userRow = { id: 'u1', passwordHash: 'stored-hash' }

function makePost(body: unknown) {
  return new Request('http://localhost/api/account/password', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('POST /api/account/password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockDb)
    mockDb.update.mockReturnValue(mockDb)
    mockDb.set.mockReturnValue(mockDb)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost({ currentPassword: 'old', newPassword: 'newpassword123' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when currentPassword is missing', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await POST(makePost({ newPassword: 'newpassword123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when newPassword is missing', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await POST(makePost({ currentPassword: 'old' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when new password is shorter than 8 characters', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await POST(makePost({ currentPassword: 'old', newPassword: 'short' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/8 characters/)
  })

  it('returns 404 when user is not found in db', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue(undefined)
    const res = await POST(makePost({ currentPassword: 'changeme', newPassword: 'newpassword123' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when current password is incorrect', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue(userRow)
    mockCompareSync.mockReturnValue(false)
    const res = await POST(makePost({ currentPassword: 'wrongpass', newPassword: 'newpassword123' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Current password is incorrect')
  })

  it('updates the password hash on success', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue(userRow)
    mockCompareSync.mockReturnValue(true)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ currentPassword: 'changeme', newPassword: 'newpassword123' }))
    expect(res.status).toBe(200)
    expect(mockHashSync).toHaveBeenCalledWith('newpassword123', 10)
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.passwordHash).toBe('new-hash')
  })

  it('returns ok: true on success', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue(userRow)
    mockCompareSync.mockReturnValue(true)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ currentPassword: 'changeme', newPassword: 'newpassword123' }))
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('verifies current password against stored hash', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue(userRow)
    mockCompareSync.mockReturnValue(true)
    mockDb.run.mockReturnValue(undefined)
    await POST(makePost({ currentPassword: 'changeme', newPassword: 'newpassword123' }))
    expect(mockCompareSync).toHaveBeenCalledWith('changeme', 'stored-hash')
  })
})
