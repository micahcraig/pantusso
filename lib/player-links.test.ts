import { describe, it, expect } from 'vitest'
import { buildMailto, buildWaMe, buildGoogleCalendarUrl } from './player-links'

describe('buildMailto', () => {
  it('returns bare mailto when no subject or body', () => {
    expect(buildMailto('a@b.com')).toBe('mailto:a@b.com')
  })

  it('includes subject when provided', () => {
    const result = buildMailto('a@b.com', 'Hello World')
    expect(result).toBe('mailto:a@b.com?subject=Hello%20World')
  })

  it('includes body when provided', () => {
    const result = buildMailto('a@b.com', undefined, 'Some body text')
    expect(result).toBe('mailto:a@b.com?body=Some%20body%20text')
  })

  it('includes both subject and body', () => {
    const result = buildMailto('a@b.com', 'Subj', 'Body')
    expect(result).toBe('mailto:a@b.com?subject=Subj&body=Body')
  })

  it('encodes special characters in subject', () => {
    const result = buildMailto('a@b.com', 'Spring 2026 vs Rivals 5/6/26 6:00 PM @ Field 1')
    expect(result).toContain('subject=Spring%202026%20vs%20Rivals%205%2F6%2F26')
  })

  it('encodes newlines in body', () => {
    const result = buildMailto('a@b.com', undefined, 'In: https://x.com\nOut: https://y.com')
    expect(result).toContain('%0A')
  })

  it('does not use + for spaces (uses %20)', () => {
    const result = buildMailto('a@b.com', 'Hello World', 'Line one\nLine two')
    expect(result).not.toContain('+')
    expect(result).toContain('%20')
  })
})

describe('buildWaMe', () => {
  it('returns wa.me URL with "availability" text when no subject or url', () => {
    expect(buildWaMe('+1 555-0100')).toBe(
      'https://wa.me/15550100?text=' + encodeURIComponent('availability')
    )
  })

  it('strips all non-digit characters from the phone number', () => {
    expect(buildWaMe('+1 (555) 010-0200')).toMatch(/^https:\/\/wa\.me\/15550100200/)
  })

  it('includes text with subject and url', () => {
    const result = buildWaMe('15550100', 'Spring 2026', 'https://example.com/avail/tok')
    expect(result).toBe(
      'https://wa.me/15550100?text=' +
      encodeURIComponent('Spring 2026 availability https://example.com/avail/tok')
    )
  })

  it('includes "availability" keyword between subject and url', () => {
    const result = buildWaMe('15550100', 'Spring', 'https://x.com/tok')
    expect(decodeURIComponent(result)).toContain('Spring availability https://x.com/tok')
  })

  it('omits url segment when url is not provided', () => {
    const result = buildWaMe('15550100', 'Spring 2026')
    expect(decodeURIComponent(result)).toContain('Spring 2026 availability')
    expect(result).not.toContain('undefined')
  })

  it('omits subject segment when subject is not provided', () => {
    const result = buildWaMe('15550100', undefined, 'https://x.com/tok')
    expect(decodeURIComponent(result)).toContain('availability https://x.com/tok')
    expect(result).not.toContain('undefined')
  })

  it('encodes special characters in the text param', () => {
    const result = buildWaMe('15550100', 'Spring & Summer', 'https://x.com/tok')
    expect(result).not.toContain(' ')
    expect(result).toContain('%')
  })
})

describe('buildGoogleCalendarUrl', () => {
  const base = { date: '2026-06-01', time: '18:30', title: 'Spring 2026 vs Rivals', location: 'Field 1' }

  it('returns a Google Calendar render URL', () => {
    expect(buildGoogleCalendarUrl(base)).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/)
  })

  it('sets action=TEMPLATE', () => {
    expect(buildGoogleCalendarUrl(base)).toContain('action=TEMPLATE')
  })

  it('formats start datetime correctly', () => {
    expect(buildGoogleCalendarUrl(base)).toContain('20260601T183000')
  })

  it('sets end time exactly 1 hour after start', () => {
    const url = decodeURIComponent(buildGoogleCalendarUrl(base))
    expect(url).toContain('20260601T183000/20260601T193000')
  })

  it('handles midnight rollover — end time crosses into next day', () => {
    const url = decodeURIComponent(buildGoogleCalendarUrl({ ...base, time: '23:30' }))
    expect(url).toContain('20260601T233000/20260602T003000')
  })

  it('handles zero-padded hours and minutes', () => {
    const url = decodeURIComponent(buildGoogleCalendarUrl({ ...base, time: '09:05' }))
    expect(url).toContain('20260601T090500/20260601T100500')
  })

  it('includes the title in the URL', () => {
    const params = new URLSearchParams(buildGoogleCalendarUrl(base).split('?')[1])
    expect(params.get('text')).toBe('Spring 2026 vs Rivals')
  })

  it('includes the location in the URL', () => {
    const params = new URLSearchParams(buildGoogleCalendarUrl(base).split('?')[1])
    expect(params.get('location')).toBe('Field 1')
  })
})
