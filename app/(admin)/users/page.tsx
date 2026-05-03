import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/session'
import { db } from '@/db'
import { users } from '@/db/schema'

export default async function UsersPage() {
  const session = await requireAdmin()

  const allUsers = await db.select().from(users).orderBy(users.createdAt).all()

  async function createUser(data: FormData) {
    'use server'
    const name     = (data.get('name')     as string).trim()
    const email    = (data.get('email')    as string).trim()
    const password =  data.get('password') as string
    if (!name || !email || !password) return
    await db.insert(users).values({
      id:           randomUUID(),
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role:         'manager',
      isActive:     true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    }).run()
    revalidatePath('/users')
  }

  async function setActive(data: FormData) {
    'use server'
    const id       = data.get('id')       as string
    const isActive = data.get('isActive') === 'true'
    await db.update(users).set({ isActive: !isActive, updatedAt: new Date() }).where(eq(users.id, id)).run()
    revalidatePath('/users')
  }

  return (
    <>
      <h1>User Management</h1>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {/* Prevent deactivating the current user or any admin */}
                  {user.role !== 'admin' && user.id !== session.user.id && (
                    <form action={setActive} style={{ display: 'inline' }}>
                      <input type="hidden" name="id"       value={user.id} />
                      <input type="hidden" name="isActive" value={String(user.isActive)} />
                      <button type="submit" className={`btn btn-sm ${user.isActive ? 'btn-danger' : 'btn-secondary'}`}>
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-4">
        <h2>Add Co-Manager</h2>
        <form action={createUser} className="form-row">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required placeholder="Full name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="email@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="Temporary password" />
          </div>
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>
    </>
  )
}
