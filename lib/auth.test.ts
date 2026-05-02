import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const mockDbChain = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','get']) chain[m] = vi.fn()
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  return chain
})

vi.mock('@/db', () => ({ db: mockDbChain }))
vi.mock('bcryptjs', () => ({ default: { compareSync: vi.fn() } }))
vi.mock('next-auth/providers/credentials', () => ({
  default: (cfg: unknown) => cfg,
}))

import { authOptions } from '@/lib/auth'

// Access the authorize callback via the credentials provider config
const authorize = (authOptions.providers[0] as any).authorize as (
  credentials: { email: string; password: string } | undefined
) => Promise<unknown>

const callbacks = authOptions.callbacks!

describe('authorize', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when credentials are missing', async () => {
    expect(await authorize(undefined)).toBeNull()
    expect(await authorize({ email: '', password: 'pw' })).toBeNull()
    expect(await authorize({ email: 'a@b.com', password: '' })).toBeNull()
  })

  it('returns null when user is not found', async () => {
    mockDbChain.get.mockReturnValue(undefined)
    expect(await authorize({ email: 'nobody@example.com', password: 'pw' })).toBeNull()
  })

  it('returns null when user is inactive', async () => {
    mockDbChain.get.mockReturnValue({ id: 'u1', isActive: false, passwordHash: 'hash' })
    expect(await authorize({ email: 'inactive@example.com', password: 'pw' })).toBeNull()
  })

  it('returns null when password is wrong', async () => {
    mockDbChain.get.mockReturnValue({ id: 'u1', isActive: true, passwordHash: 'hash' })
    vi.mocked(bcrypt.compareSync).mockReturnValue(false)
    expect(await authorize({ email: 'user@example.com', password: 'wrong' })).toBeNull()
  })

  it('returns user data when credentials are valid', async () => {
    const dbUser = { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'admin', isActive: true, passwordHash: 'hash' }
    mockDbChain.get.mockReturnValue(dbUser)
    vi.mocked(bcrypt.compareSync).mockReturnValue(true)
    const result = await authorize({ email: 'alice@example.com', password: 'correct' })
    expect(result).toEqual({ id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'admin' })
  })
})

describe('jwt callback', () => {
  it('augments token with id and role when user is present', () => {
    const token = { sub: 'u1' }
    const user  = { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'admin' }
    const result = (callbacks.jwt as any)({ token, user })
    expect(result.id).toBe('u1')
    expect(result.role).toBe('admin')
  })

  it('returns token unchanged when no user', () => {
    const token = { sub: 'u1', id: 'u1', role: 'manager' }
    const result = (callbacks.jwt as any)({ token, user: undefined })
    expect(result).toEqual(token)
  })
})

describe('session callback', () => {
  it('copies id and role from token onto session.user', () => {
    const session = { user: { name: 'Alice', email: 'alice@example.com' }, expires: '2099-01-01' }
    const token   = { id: 'u1', role: 'admin' }
    const result = (callbacks.session as any)({ session, token })
    expect(result.user.id).toBe('u1')
    expect(result.user.role).toBe('admin')
  })
})
