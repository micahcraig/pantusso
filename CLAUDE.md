# CLAUDE.md — Pantusso / Softball Team Manager

This file gives Claude Code the context needed to work on this project without re-reading the full spec.

---

## What this is

A web app for managing a recreational softball team. One admin (the manager) plus optional co-managers. No player accounts — players interact only via a public token-gated availability page.

Full spec: `~/Downloads/softball-handoff.docx`

---

## Tech stack

- **Next.js 14** — App Router, Server Components, Server Actions, `'use client'` where needed
- **TypeScript** — strict, no `any`
- **Drizzle ORM 0.30** — SQLite for dev/test (`better-sqlite3`), MySQL for prod (`mysql2`). Driver swap is in `db/index.ts` based on `DATABASE_URL`.
- **NextAuth.js v4** — credentials provider, JWT strategy. Extended types in `types/next-auth.d.ts`.
- **ebbets** — local npm package at `../ebbets` (linked via `"ebbets": "file:../ebbets"`). A controlled React lineup editor built on dnd-kit. Type declarations in `types/ebbets.d.ts`.
- **bcryptjs** — password hashing
- **vitest** — test runner

---

## Key commands

```bash
npm run dev              # start dev server
npm run typecheck        # tsc --noEmit (run this before declaring anything done)
npm run lint             # eslint
npm run test             # vitest
npm run test:e2e:sqlite  # Playwright E2E against local SQLite dev server
npm run test:e2e:mysql   # Playwright E2E against a temporary MySQL Docker container (requires Docker)
npm run test:e2e         # runs both test:e2e:sqlite and test:e2e:mysql
npm run db:generate      # drizzle-kit generate — create migration after schema change
npm run db:migrate       # drizzle-kit migrate — apply pending migrations
npm run db:seed          # tsx db/seed.ts — idempotent, safe to re-run
```

---

## Project structure

```
app/
  (admin)/          # All auth-gated pages share this layout + nav
    layout.tsx      # requireSession() guard, NavLinks client component, page shell
    error.tsx       # Error boundary for admin pages
    loading.tsx     # Loading fallback
    seasons/        # List + detail (games table, W/L/T/run-diff, per-opponent record)
    roster/         # Player list + player detail/edit + availability URL
    opponents/      # Opponent CRUD
    users/          # User management — admin role only (requireAdmin)
    games/[id]/     # Game detail: attendance panel + lineup editor + record result
  availability/[token]/  # Public page — no auth, players self-report availability
  login/            # NextAuth credentials sign-in
  api/              # Fetch targets for client components
    availability/[token]/   # GET + PATCH (public, no auth check)
    games/[id]/             # PATCH game fields
    games/[id]/attendance/  # PATCH attendance (admin client component)
    games/[id]/lineup/      # GET + PUT lineup entries
    seasons/[id]/games/     # POST new game
    seasons/[id]/roster/    # GET + POST + DELETE season roster members
    roster/                 # GET + POST players
    opponents/              # GET + POST opponents
    users/                  # GET + POST users
    users/[id]/             # PATCH user (toggle active, change role)

components/
  NavLinks.tsx                  # 'use client' — active nav link via usePathname
  SignOutButton.tsx              # 'use client' — NextAuth signOut
  lineup-editor-wrapper/index.tsx  # 'use client' — wraps ebbets LineupManager

lib/
  auth.ts           # NextAuth authOptions
  session.ts        # requireSession() and requireAdmin() — use these in every admin page
  availability.ts   # lookupPlayerByToken, getUpcomingGames, setAttendance
  games.ts          # createGameWithRoster (inserts game + seeds game_players for roster)

db/
  schema.ts         # All tables, relations, exported TS types
  index.ts          # Driver-switching db singleton
  seed.ts           # Dev seed
  migrations/       # SQL files — never edit by hand
```

---

## Database schema (summary)

| Table | Key columns |
|---|---|
| `users` | `id`, `email`, `password_hash`, `role` (admin\|manager), `is_active` |
| `players` | `id`, `name`, `jersey_number`, `preferred_positions` (JSON), `availability_token`, `is_active` |
| `seasons` | `id`, `name`, `start_date`, `end_date` |
| `season_roster` | `season_id` + `player_id` (composite PK) |
| `opponents` | `id`, `name`, `notes` |
| `games` | `id`, `season_id`, `opponent_id`, `date`, `time`, `location`, `home_or_away`, `our_score`, `opponent_score`, `status` (scheduled\|completed\|cancelled) |
| `game_players` | `id`, `game_id`, `player_id`, `attendance` (confirmed\|out\|unknown), `availability_set_at`, `availability_updated_at` |
| `lineup_entries` | `id`, `game_id`, `player_id`, `batting_order`, `position`, `lineup_status` (active\|bench\|did_not_bat) |

Schema changes: edit `db/schema.ts`, then `npm run db:generate`, then `npm run db:migrate`.

---

## Patterns to follow

### Auth guards
Every admin server component must start with one of:
```ts
await requireSession()  // any logged-in user
await requireAdmin()    // admin role only
```

### Database queries
Use the `db` singleton from `@/db`. All queries are synchronous (SQLite/better-sqlite3):
```ts
db.select().from(table).where(eq(table.id, id)).get()    // single row
db.select().from(table).all()                            // all rows
db.insert(table).values({...}).run()
db.update(table).set({...}).where(...).run()
```

### Server Actions (form mutations)
Define inline in server components, mark with `'use server'`, call `revalidatePath` after mutations:
```ts
async function doThing(data: FormData) {
  'use server'
  // ... db call
  revalidatePath('/some-path')
}
```

### TypeScript narrowing in Server Action closures
`.get()` returns `T | undefined`. After `if (!row) notFound()`, TypeScript won't narrow `row` inside a closure (Server Action). Fix with an intermediate assignment:
```ts
const row = db.select()...get()
if (!row) notFound()
const safeRow = row  // TypeScript sees safeRow as non-nullable in closures
```

### Client components that call APIs
Use `useState` + `fetch` (not Server Actions). See `AttendancePanel.tsx` and `components/lineup-editor-wrapper/index.tsx` for the established pattern.

### ebbets lineup editor
The `LineupManager` component requires `dynamic(..., { ssr: false })` because of dnd-kit browser APIs. The wrapper in `components/lineup-editor-wrapper/` owns all translation between DB `LineupEntry[]` and ebbets `EbbetsPlayer[]`. The PUT endpoint at `/api/games/[id]/lineup` atomically replaces all entries (delete + insert).

---

## Things to avoid

- Don't use `any` — cast through `unknown` if needed
- Don't add `console.log` statements
- Don't use `drizzle-orm/mysql` builders in `db/schema.ts` — it must stay on SQLite builders; the MySQL driver swap is runtime-only
- Don't create `next.config.ts` — Next.js 14 doesn't support it; use `next.config.mjs`
- Don't add `@typescript-eslint/no-unused-vars` to `.eslintrc.json` — `eslint-config-next` doesn't include that plugin
- `notFound()` and `redirect()` throw internally — don't put them in try/catch blocks

---

## Environment variables

```
DATABASE_URL      sqlite:./dev.db  (or mysql://... for prod)
NEXTAUTH_SECRET   any long random string
NEXTAUTH_URL      http://localhost:3000
SEED_ADMIN_NAME   used only by db:seed
SEED_ADMIN_EMAIL  used only by db:seed
SEED_ADMIN_PASSWORD used only by db:seed
```

See `.env.example` for the full template.

---

## Implementation status

All 10 phases are complete:

1. Project scaffold (Next.js, Drizzle, NextAuth, Docker, GH Actions)
2. DB schema + migrations + seed
3. Auth + user management
4. Roster CRUD
5. Seasons, opponents, games
6. Attendance management (admin)
7. Player availability pages (public token-gated)
8. Lineup editor integration (ebbets)
9. Results and standings (score recording, W/L/T/run-diff, per-opponent record)
10. Polish (responsive layout, active nav, error boundaries, loading states, Docker fixes)
