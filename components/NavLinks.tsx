'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/seasons',   label: 'Seasons' },
    { href: '/roster',    label: 'Roster' },
    { href: '/opponents', label: 'Opponents' },
    ...(isAdmin ? [
      { href: '/users', label: 'Users' },
    ] : []),
  ]

  const linkClass = (href: string) =>
    `nav-link${pathname.startsWith(href) ? ' nav-link-active' : ''}`

  return (
    <>
      <nav className="nav-links">
        {links.map(link => (
          <Link key={link.href} href={link.href} className={linkClass(link.href)}>
            {link.label}
          </Link>
        ))}
      </nav>

      <button className="nav-hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
        {open ? '✕' : '☰'}
      </button>

      {open && (
        <div className="nav-menu">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
