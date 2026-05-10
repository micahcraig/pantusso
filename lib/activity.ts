import { db } from '@/db'
import { activityLog } from '@/db/schema'
import type { ActivityEventType } from '@/db/schema'

export async function logActivity({
  seasonId,
  gameId,
  playerId,
  eventType,
  payload,
}: {
  seasonId:  string
  gameId?:   string | null
  playerId?: string | null
  eventType: ActivityEventType
  payload:   Record<string, unknown>
}) {
  await db.insert(activityLog).values({
    seasonId,
    gameId:    gameId    ?? undefined,
    playerId:  playerId  ?? undefined,
    eventType,
    payload,
    createdAt: new Date(),
  }).run()
}
