'use client'

import type { Position } from '@/db/schema'

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'P',    label: 'P – Pitcher' },
  { value: 'C',    label: 'C – Catcher' },
  { value: '1B',   label: '1B – First Base' },
  { value: '2B',   label: '2B – Second Base' },
  { value: '3B',   label: '3B – Third Base' },
  { value: 'SS',   label: 'SS – Shortstop' },
  { value: 'LF',   label: 'LF – Left Field' },
  { value: 'CF',   label: 'CF – Center Field' },
  { value: 'RF',   label: 'RF – Right Field' },
  { value: 'DP',   label: 'DP – Designated Player' },
  { value: 'FLEX', label: 'FLEX' },
]

export default function PositionCheckboxes({ selected = [] }: { selected?: Position[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 20px' }}>
      {POSITIONS.map(pos => (
        <label key={pos.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="preferredPositions"
            value={pos.value}
            defaultChecked={selected.includes(pos.value)}
          />
          {pos.label}
        </label>
      ))}
    </div>
  )
}
