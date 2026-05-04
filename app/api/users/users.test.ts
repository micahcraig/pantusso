import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockRandomUUID = vi.hoisted(() => vi.fn().mockReturnValue('new-user-id'))
vi.mock('crypto', () => ({ randomUUID: mockRandomUUID }))

vi.mock('bcryptjs', () => ({ default: { hashSync: vi.fn().mockReturnValue('hashed-pw') } }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','insert','values','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/db/schema', () => ({ users: {} }))

import { GET, POST } from '@/app/api/users/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

function makePost(body: unknown) {
  return new Request('http://localhost/api/users', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/users', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns user list for admin', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const rows = [{ id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin', isActive: true }]
    mockDb.all.mockReturnValue(rows)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('u1')
  })
})

describe('POST /api/users', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.insert.mockReturnValue(mockDb); mockDb.values.mockReturnValue(mockDb) })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost({ name: 'Bob', email: 'bob@example.com', password: 'secret123' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await POST(makePost({ name: 'Bob', email: 'bob@example.com', password: 'secret123' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ email: 'bob@example.com', password: 'secret123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ name: 'Bob', password: 'secret123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost({ name: 'Bob', email: 'bob@example.com' }))
    expect(res.status).toBe(400)
  })

  it('creates user and returns 201 without passwordHash', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await POST(makePost({ name: 'Bob', email: 'bob@example.com', password: 'secret123' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-user-id')
    expect(body.name).toBe('Bob')
    expect(body.role).toBe('manager')
    expect(body.passwordHash).toBeUndefined()
  })

  it('hashes the password before storing', async () => {
    const bcrypt = await import('bcryptjs')
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    await POST(makePost({ name: 'Bob', email: 'bob@example.com', password: 'secret123' }))
    expect(bcrypt.default.hashSync).toHaveBeenCalledWith('secret123', 10)
  })
})
