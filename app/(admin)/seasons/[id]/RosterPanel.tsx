'use client'

import { useState } from 'react'
import type { Position } from '@/db/schema'
import PlayerName from '@/components/PlayerName'

type Player = {
  id: string
  name: string
  jerseyNumber: string | null
  preferredPositions: Position[]
  email: string | null
  whatsapp: string | null
  availabilityToken: string
}

export default function RosterPanel({
  seasonId,
  seasonName,
  availabilityBaseUrl,
  allPlayers,
  initialRosterIds,
}: {
  seasonId: string
  seasonName: string
  availabilityBaseUrl: string
  allPlayers: Player[]
  initialRosterIds: string[]
}) {
  const [rosterIds, setRosterIds] = useState(() => new Set(initialRosterIds))
  const [loading, setLoading]     = useState<Set<string>>(() => new Set())

  async function toggle(playerId: string) {
    const wasInRoster = rosterIds.has(playerId)
    const inRoster    = !wasInRoster

    setRosterIds(prev => {
      const next = new Set(prev)
      inRoster ? next.add(playerId) : next.delete(playerId)
      return next
    })
    setLoading(prev => new Set(prev).add(playerId))

    try {
      const res = await fetch(`/api/seasons/${seasonId}/roster`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ playerId, inRoster }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setRosterIds(prev => {
        const next = new Set(prev)
        wasInRoster ? next.add(playerId) : next.delete(playerId)
        return next
      })
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(playerId)
        return next
      })
    }
  }

  return (
    <div className="card">
      {allPlayers.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No active players.</p>
      ) : (
        allPlayers.map((p, i) => {
          const inRoster = rosterIds.has(p.id)
          const busy     = loading.has(p.id)
          return (
            <div
              key={p.id}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:           12,
                padding:       '10px 0',
                borderBottom:  i < allPlayers.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <div style={{ width: 30, color: '#9ca3af', fontWeight: 600, fontSize: 14, textAlign: 'right', flexShrink: 0 }}>
                {p.jerseyNumber ?? ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PlayerName
                  name={p.name}
                  email={p.email}
                  mailtoSubject={seasonName}
                  mailtoBody={`${availabilityBaseUrl}/availability/${p.availabilityToken}`}
                  whatsapp={p.whatsapp}
                  whatsappSubject={seasonName}
                  clipboardText={`${availabilityBaseUrl}/availability/${p.availabilityToken}`}
                />
                {p.preferredPositions.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                    {p.preferredPositions.map(pos => (
                      <span
                        key={pos}
                        style={{
                          background:   '#f3f4f6',
                          color:         '#374151',
                          borderRadius:  4,
                          padding:       '1px 6px',
                          fontSize:      11,
                          fontWeight:    600,
                        }}
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                role="switch"
                aria-checked={inRoster}
                aria-label={`${inRoster ? 'Remove' : 'Add'} ${p.name}`}
                onClick={() => toggle(p.id)}
                disabled={busy}
                style={{
                  position:    'relative',
                  display:     'inline-flex',
                  width:        44,
                  height:       24,
                  borderRadius: 12,
                  border:       'none',
                  cursor:       busy ? 'wait' : 'pointer',
                  background:   inRoster ? '#4f46e5' : '#d1d5db',
                  transition:   'background 0.15s',
                  flexShrink:   0,
                  padding:       0,
                  opacity:       busy ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position:     'absolute',
                    top:           3,
                    left:          inRoster ? 23 : 3,
                    width:         18,
                    height:        18,
                    borderRadius:  '50%',
                    background:    'white',
                    transition:    'left 0.15s',
                  }}
                />
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
