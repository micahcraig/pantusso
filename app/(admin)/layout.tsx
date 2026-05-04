import Link from 'next/link'
import Image from 'next/image'
import { requireSession } from '@/lib/session'
import SignOutButton from '@/components/SignOutButton'
import NavLinks from '@/components/NavLinks'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const isAdmin = session.user.role === 'admin'

  return (
    <>
      <header className="nav">
        <Link href="/seasons" className="nav-brand">
          <Image src="/pantusso-text.png" alt="Pantusso" width={729} height={147} style={{ height: 28, width: 'auto' }} />
        </Link>
        <NavLinks isAdmin={isAdmin} />
        <div className="nav-user">
          <Link href="/account" style={{ fontSize: 14, color: 'inherit', textDecoration: 'none' }}>
            {session.user.name}
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  )
}
