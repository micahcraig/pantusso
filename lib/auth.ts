import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = db.select().from(users).where(eq(users.email, credentials.email)).get()
        if (!user || !user.isActive) return null

        const valid = bcrypt.compareSync(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        // next-auth User type doesn't include role; we add it in authorize()
        token.role = (user as unknown as { role: 'admin' | 'manager' }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id   = token.id
      session.user.role = token.role
      return session
    },
  },
  pages: { signIn: '/login' },
}
