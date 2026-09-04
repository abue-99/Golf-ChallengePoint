# AI Context – Golf ChallengePoint

> Load this file first in every AI agent run to minimise token usage. It gives a concise, actionable summary of the project so you can navigate and modify the codebase without reading every file from scratch.

---

## What is this project?

**Golf ChallengePoint** is a web-based golf coaching platform.  
Coaches design lessons, build structured development plans, schedule practice slots, and track player progress.  
Players view schedules, complete assigned lessons, and record self-assessments.  
Administrators manage clubs and user accounts.

---

## Technology Stack (one-liner each)

| Layer           | Choice                                                           |
| --------------- | ---------------------------------------------------------------- |
| Monorepo        | pnpm workspaces + Turborepo                                      |
| Backend API     | NestJS 11, TypeScript, port **4000**                             |
| Frontend        | Next.js 16 (App Router), React 19, TypeScript, port **3000**     |
| Database ORM    | Prisma 7 + PostgreSQL                                            |
| Auth            | httpOnly JWT access token cookie + httpOnly refresh cookie       |
| UI              | shadcn/ui, Radix UI, Tailwind CSS v4                             |
| Calendar widget | FullCalendar v6                                                  |
| Data fetching   | TanStack React Query + SWR                                       |
| Email           | Resend SDK                                                       |
| Reverse proxy   | Caddy 2 (`/api/*` → 4000, `/*` → 3000)                           |
| Containers      | Docker + Docker Compose                                          |

---

## Workspace Layout

```
/
├── apps/
│   ├── api/          # NestJS backend  (package: @challengepoint/api)
│   └── web/          # Next.js frontend (package: golf-challenge-point-web)
├── packages/
│   └── db/           # Shared Prisma schema + generated client (package: @challengepoint/db)
├── docs/             # AI context documents (this folder)
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

- **Run dev**: `pnpm dev` (runs `pnpm --filter @challengepoint/db run generate` first)
- **Build**: `pnpm build` (Turborepo cache-aware)
- **Lint**: `pnpm lint`
- **Turbo filter for web**: `--filter=golf-challenge-point-web`
- **Turbo filter for api**: `--filter=api`
- Before building api, run: `pnpm --filter db prisma generate`

---

## Role & Permission Summary

| Role       | Key capabilities                                                                     |
| ---------- | ------------------------------------------------------------------------------------ |
| `PLAYER`   | Own calendar, practice slots, assigned lessons, self-assessment, own profile         |
| `COACH`    | + invite/link players, create lessons, manage teams, development plans, assign tasks |
| `ADMIN`    | + list/edit all users, change roles (COACH/ADMIN), delete users, club settings       |
| `SYSADMIN` | + create/delete clubs, assign any role, manage club memberships for any user         |

---

## Auth Flow

1. `POST /auth/login` in the NestJS API returns `{ accessToken, user }` and sets the httpOnly `refresh_token` cookie.
2. The Next.js login proxy forwards that response and persists `accessToken` as the httpOnly `token` cookie used by web proxy routes and middleware.
3. Next.js middleware (`apps/web/middleware.ts`) protects all `(app)` routes.
4. All browser API calls go through Next.js proxy routes (`apps/web/app/api/…`) to avoid CORS.
5. On 401, client fetches retry through `apps/web/lib/api.ts`, while server-side proxy routes can refresh via `apps/web/lib/api-proxy-auth.ts` and retry with rotated cookies.

---

## Key Conventions

- All IDs are **cuid** strings.
- Prisma schema is the single source of truth for the DB; shared via `packages/db`.
- NestJS uses `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- JSON body limit: 5 MB.
- bcrypt cost factor: 10.
- `pnpm/action-setup` must **not** set `with.version` when root `package.json` already pins pnpm via `packageManager`.
- CI workflows lint only specific files (not full Turbo lint) to keep runs fast.

---

## Where to look for things

| What you need                    | Where to find it                                                          |
| -------------------------------- | ------------------------------------------------------------------------- |
| DB schema / models / enums       | `packages/db/prisma/schema.prisma`                                        |
| DB migrations                    | `packages/db/prisma/migrations/`                                          |
| API endpoints & business logic   | `apps/api/src/<module>/`                                                  |
| API route map                    | `docs/repository-map.md`                                                  |
| Full domain model                | `docs/domain-model.md`                                                    |
| Next.js pages                    | `apps/web/app/(app)/` and `apps/web/app/(public)/`                        |
| Next.js API proxy routes         | `apps/web/app/api/` and `apps/web/app/auth/`                              |
| Shared TypeScript types          | `apps/web/lib/types.ts`, `apps/web/lib/lesson-types.ts`                   |
| Gamification/XP logic            | `apps/api/src/gamification/`, `apps/web/components/GamificationStats.tsx` |
| Player capabilities (skill tree) | `apps/web/lib/player-capabilities.ts`                                     |
| Email sending                    | `apps/web/lib/email.ts`                                                   |
| Auth cookies helper              | `apps/web/lib/auth-cookies.ts`                                            |
| Proxy auth-refresh helper        | `apps/web/lib/api-proxy-auth.ts`                                          |
| GitHub CI workflows              | `.github/workflows/`                                                      |

---

## Common Patterns

- **Coach–player link required**: before a coach can view/assign anything for a player, a `CoachPlayerLink` record must exist. Links are created via invite, manual coach addition, or player adding coach.
- **OwnerType**: `PracticeSlot` and `PlayerDevelopmentPlan` support both `PLAYER` and `TEAM` owners. Check `ownerType` to know which FK (`playerId` vs `teamId`) is set.
- **Lesson assignment model**: coaches can create standalone `LessonAssignment` queue items directly from the integrated `/teams` view, or attach lessons to `TrainingBlock`s inside a `PlayerDevelopmentPlan`.
- **Journey assignment model**: coaches can create reusable `JourneyTemplate`s and assign them directly to players or whole teams; server-side journey and coach assignment proxy routes now retry once after refreshing expired access tokens.
- **Pending lesson counters**: coach-facing `/teams` and `/users/me/players` responses include computed `pendingLessons`; team counts aggregate open queue items across all active members.
- **Calendar hierarchy**: `PracticeSlot` (recurring time block) → `CalendarTask` (specific task on a date within the slot).
- **Gamification**: `PlayerProfile` tracks `xp`, `level`, `currentStreak`, `longestStreak`, `lastActivityAt`.
