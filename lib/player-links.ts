export function buildMailto(email: string, subject?: string, body?: string) {
  const parts: string[] = []
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`)
  if (body)    parts.push(`body=${encodeURIComponent(body)}`)
  return `mailto:${email}${parts.length ? '?' + parts.join('&') : ''}`
}

export function buildWaMe(whatsapp: string, subject?: string, url?: string) {
  const digits = whatsapp.replace(/\D/g, '')
  const text   = [subject, 'availability', url].filter(Boolean).join(' ')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function buildGoogleCalendarUrl({
  date,
  time,
  title,
  location,
}: {
  date:     string  // 'YYYY-MM-DD'
  time:     string  // 'HH:MM'
  title:    string
  location: string
}): string {
  const [year, month, day] = date.split('-').map(Number)
  const [h, m]             = time.split(':').map(Number)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

  const start = new Date(year, month - 1, day, h, m, 0)
  const end   = new Date(year, month - 1, day, h + 1, m, 0)

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     title,
    dates:    `${fmt(start)}/${fmt(end)}`,
    location,
  })

  return `https://calendar.google.com/calendar/render?${params}`
}
