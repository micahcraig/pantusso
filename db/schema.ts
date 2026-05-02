import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DP' | 'FLEX' | 'BN'
export type LineupStatus = 'active' | 'bench' | 'did_not_bat'
export type AttendanceStatus = 'confirmed' | 'maybe' | 'out' | 'unknown'
export type UserRole = 'admin' | 'manager'
export type HomeOrAway = 'home' | 'away'
export type GameStatus = 'scheduled' | 'completed' | 'cancelled'

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => randomUUID()),
  name:         text('name').notNull(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['admin', 'manager'] as const }).notNull().default('manager'),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// ── Players ───────────────────────────────────────────────────────────────────

export const players = sqliteTable('players', {
  id:                 text('id').primaryKey().$defaultFn(() => randomUUID()),
  name:               text('name').notNull(),
  jerseyNumber:       text('jersey_number').notNull(),
  preferredPositions: text('preferred_positions', { mode: 'json' }).$type<Position[]>().notNull().default(sql`'[]'`),
  phone:              text('phone'),
  email:              text('email'),
  whatsapp:           text('whatsapp'),
  notes:              text('notes'),
  availabilityToken:  text('availability_token').notNull().unique().$defaultFn(() => randomUUID()),
  isActive:           integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:          integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:          integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  availabilityTokenIdx: index('player_availability_token_idx').on(t.availabilityToken),
}))

// ── Seasons ───────────────────────────────────────────────────────────────────

export const seasons = sqliteTable('seasons', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  name:      text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate:   text('end_date').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// ── Season Roster ─────────────────────────────────────────────────────────────

export const seasonRoster = sqliteTable('season_roster', {
  seasonId:  text('season_id').notNull().references(() => seasons.id),
  playerId:  text('player_id').notNull().references(() => players.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  pk: primaryKey({ columns: [t.seasonId, t.playerId] }),
}))

// ── Opponents ─────────────────────────────────────────────────────────────────

export const opponents = sqliteTable('opponents', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  name:      text('name').notNull(),
  notes:     text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// ── Games ─────────────────────────────────────────────────────────────────────

export const games = sqliteTable('games', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  seasonId:      text('season_id').notNull().references(() => seasons.id),
  opponentId:    text('opponent_id').notNull().references(() => opponents.id),
  date:          text('date').notNull(),       // YYYY-MM-DD
  time:          text('time').notNull(),       // HH:MM
  location:      text('location').notNull(),
  homeOrAway:    text('home_or_away', { enum: ['home', 'away'] as const }).notNull(),
  ourScore:      integer('our_score'),
  opponentScore: integer('opponent_score'),
  status:        text('status', { enum: ['scheduled', 'completed', 'cancelled'] as const }).notNull().default('scheduled'),
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:     integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  dateIdx:         index('game_date_idx').on(t.date),
  seasonStatusIdx: index('game_season_status_idx').on(t.seasonId, t.status),
}))

// ── Game Players ──────────────────────────────────────────────────────────────

export const gamePlayers = sqliteTable('game_players', {
  id:                    text('id').primaryKey().$defaultFn(() => randomUUID()),
  gameId:                text('game_id').notNull().references(() => games.id),
  playerId:              text('player_id').notNull().references(() => players.id),
  attendance:            text('attendance', { enum: ['confirmed', 'maybe', 'out', 'unknown'] as const }).notNull().default('unknown'),
  note:                  text('note'),
  availabilitySetAt:     integer('availability_set_at', { mode: 'timestamp' }),
  availabilityUpdatedAt: integer('availability_updated_at', { mode: 'timestamp' }),
}, (t) => ({
  gameIdIdx:   index('game_player_game_id_idx').on(t.gameId),
  playerIdIdx: index('game_player_player_id_idx').on(t.playerId),
}))

// ── Lineup Entries ────────────────────────────────────────────────────────────

export const lineupEntries = sqliteTable('lineup_entries', {
  id:           text('id').primaryKey().$defaultFn(() => randomUUID()),
  gameId:       text('game_id').notNull().references(() => games.id),
  playerId:     text('player_id').notNull().references(() => players.id),
  battingOrder: integer('batting_order'),
  position:     text('position', { enum: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DP', 'FLEX', 'BN'] as const }),
  lineupStatus: text('lineup_status', { enum: ['active', 'bench', 'did_not_bat'] as const }).notNull(),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  gameIdIdx:   index('lineup_entry_game_id_idx').on(t.gameId),
  playerIdIdx: index('lineup_entry_player_id_idx').on(t.playerId),
}))

// ── Relations ─────────────────────────────────────────────────────────────────

export const playersRelations = relations(players, ({ many }) => ({
  seasonRoster:  many(seasonRoster),
  gamePlayers:   many(gamePlayers),
  lineupEntries: many(lineupEntries),
}))

export const seasonsRelations = relations(seasons, ({ many }) => ({
  seasonRoster: many(seasonRoster),
  games:        many(games),
}))

export const seasonRosterRelations = relations(seasonRoster, ({ one }) => ({
  season: one(seasons, { fields: [seasonRoster.seasonId], references: [seasons.id] }),
  player: one(players, { fields: [seasonRoster.playerId],  references: [players.id] }),
}))

export const opponentsRelations = relations(opponents, ({ many }) => ({
  games: many(games),
}))

export const gamesRelations = relations(games, ({ one, many }) => ({
  season:        one(seasons,   { fields: [games.seasonId],   references: [seasons.id] }),
  opponent:      one(opponents, { fields: [games.opponentId], references: [opponents.id] }),
  gamePlayers:   many(gamePlayers),
  lineupEntries: many(lineupEntries),
}))

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game:   one(games,   { fields: [gamePlayers.gameId],   references: [games.id] }),
  player: one(players, { fields: [gamePlayers.playerId], references: [players.id] }),
}))

export const lineupEntriesRelations = relations(lineupEntries, ({ one }) => ({
  game:   one(games,   { fields: [lineupEntries.gameId],   references: [games.id] }),
  player: one(players, { fields: [lineupEntries.playerId], references: [players.id] }),
}))

// ── Inferred types ────────────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect
export type NewUser      = typeof users.$inferInsert
export type Player       = typeof players.$inferSelect
export type NewPlayer    = typeof players.$inferInsert
export type Season       = typeof seasons.$inferSelect
export type NewSeason    = typeof seasons.$inferInsert
export type Opponent     = typeof opponents.$inferSelect
export type NewOpponent  = typeof opponents.$inferInsert
export type Game         = typeof games.$inferSelect
export type NewGame      = typeof games.$inferInsert
export type GamePlayer   = typeof gamePlayers.$inferSelect
export type NewGamePlayer = typeof gamePlayers.$inferInsert
export type LineupEntry  = typeof lineupEntries.$inferSelect
export type NewLineupEntry = typeof lineupEntries.$inferInsert
