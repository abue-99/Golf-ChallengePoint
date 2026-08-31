# Repository Map – Golf ChallengePoint

> Quick reference for navigating the codebase. See `docs/ai-context.md` for project overview and `docs/domain-model.md` for the data model.

---

## Top-level structure

```
/
├── apps/
│   ├── api/                  # NestJS 11 backend
│   └── web/                  # Next.js 16 frontend
├── packages/
│   └── db/                   # Shared Prisma schema + generated Prisma client
├── docs/                     # AI context documents
├── scripts/                  # Deployment and utility shell scripts
├── infra/                    # Alternative docker-compose for infrastructure
├── .github/workflows/        # GitHub Actions CI pipelines
├── docker-compose.yml        # Production multi-service compose
├── Caddyfile                 # Caddy reverse-proxy config
├── turbo.json                # Turborepo task graph
├── pnpm-workspace.yaml       # pnpm workspace definition
├── TECHNICAL_DESCRIPTION.md  # Verbose project description (existing doc)
└── CHANGELOG.md
```

---

## `packages/db/`

| Path | Description |
|---|---|
| `prisma/schema.prisma` | **Single source of truth** for the database schema |
| `prisma/migrations/` | Prisma migration SQL history |
| `prisma/seed.ts` | Database seed script |
| `index.ts` / `db.ts` | Re-exports the generated Prisma client |
| `package.json` | Package name: `@challengepoint/db` |

---

## `apps/api/` – NestJS Backend

Base URL in dev: `http://localhost:4000`

### Source modules (`apps/api/src/`)

| Module folder | NestJS module | Responsibility |
|---|---|---|
| `auth/` | `AuthModule` | JWT strategy, guards, signup/login/refresh/logout/password flows |
| `clubs/` | `ClubsModule` | Club CRUD (SYSADMIN-gated write operations) |
| `teams/` | `TeamsModule` | Team management, members |
| `users/` | `UsersModule` | User CRUD, coach–player linking, invitations |
| `calendar/` | `CalendarModule` | Practice slots, calendar tasks |
| `lessons/` | `LessonsModule` | Training lesson CRUD |
| `development-plans/` | `DevelopmentPlansModule` | Development plans, training blocks, lesson assignments |
| `gamification/` | `GamificationModule` | XP, level, streak tracking |
| `prisma/` | `PrismaModule` | Singleton Prisma client provider |
| `common/exceptions/` | — | Shared exception types |
| `app.module.ts` | `AppModule` | Root module wiring |
| `main.ts` | — | Bootstrap: CORS, cookie-parser, ValidationPipe, body limit |

### Auth endpoints (`/auth`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Public | Returns `{ accessToken, user }`, sets refresh cookie |
| POST | `/auth/login` | Public | Returns `{ accessToken, user }`, sets refresh cookie |
| POST | `/auth/refresh` | Cookie | Rotates refresh token |
| POST | `/auth/logout` | JWT | Clears refresh cookie |
| GET | `/auth/me` | JWT | Full user profile |
| PATCH | `/auth/profile` | JWT | Update profile fields |
| POST | `/auth/forgot` | Public | Creates password-reset token (1 h TTL) |
| POST | `/auth/reset` | Public | Validates token, sets new password |
| POST | `/auth/change-password` | JWT | Verify current + set new password |

### Clubs endpoints (`/clubs`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/clubs/public` | Public | For signup form |
| GET | `/clubs` | Any | List all |
| POST | `/clubs` | SYSADMIN | Create |
| PATCH | `/clubs/:id` | SYSADMIN | Update |
| DELETE | `/clubs/:id` | SYSADMIN | Delete |
| GET | `/clubs/my` | Any | Current user's clubs |
| POST | `/clubs/my` | Any | Join a club |
| DELETE | `/clubs/my/:clubId` | Any | Leave a club |

### Teams endpoints (`/teams`)

All require JWT + COACH or ADMIN.

| Method | Path | Notes |
|---|---|---|
| GET | `/teams` | Coach's teams |
| GET | `/teams/:id` | Single team with members |
| GET | `/teams/categories` | Distinct categories |
| GET | `/teams/club-players?clubId=` | Players to add to team |
| POST | `/teams` | Create team |
| PATCH | `/teams/:id` | Update metadata |
| DELETE | `/teams/:id` | Delete + cascade |
| POST | `/teams/:id/members` | Add player |
| DELETE | `/teams/:id/members/:userId` | Remove player |

### Users endpoints (`/users`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/users` | ADMIN | List all |
| PATCH | `/users/:id/role` | ADMIN | Change role |
| PATCH | `/users/:id/profile` | ADMIN | Update name |
| POST | `/users/:id/clubs` | SYSADMIN | Add to club |
| DELETE | `/users/:id/clubs/:clubId` | SYSADMIN | Remove from club |
| GET | `/users/:id/coaches` | SYSADMIN | Get coaches |
| GET | `/users/:id/available-coaches` | SYSADMIN | Coaches from shared clubs |
| POST | `/users/:id/coaches/:coachId` | SYSADMIN | Link coach |
| DELETE | `/users/:id/coaches/:coachId` | SYSADMIN | Unlink coach |
| DELETE | `/users/:id` | ADMIN | Delete user |
| POST | `/users/invite` | COACH | Invite + create player |
| GET | `/users/me/players` | JWT | Coach's linked players |
| GET | `/users/me/available-coaches` | JWT | Coaches from shared clubs |
| GET | `/users/me/coaches` | JWT | Current user's coaches |
| POST | `/users/me/coaches/:coachId` | JWT | Link coach |
| DELETE | `/users/me/coaches/:coachId` | JWT | Unlink coach |
| POST | `/users/me/players/:playerId` | COACH | Link existing player |
| DELETE | `/users/me/players/:playerId` | COACH | Unlink player |
| POST | `/users/:id/resend-invite` | ADMIN | Resend invitation email |

### Calendar endpoints (`/calendar`)

| Method | Path | Notes |
|---|---|---|
| GET | `/calendar/slots?playerId=` | Practice slots (coach passes playerId) |
| POST | `/calendar/slots` | Create personal practice slot |
| PATCH | `/calendar/slots/:id` | Update slot |
| DELETE | `/calendar/slots/:id` | Delete slot |
| GET | `/calendar/team-slots/:teamId` | Team practice slots |
| POST | `/calendar/team-slots/:teamId` | Create team slot (COACH/ADMIN) |
| GET | `/calendar/slots/:slotId/tasks` | Tasks in a slot |
| POST | `/calendar/slots/:slotId/tasks` | Assign task (supports bulk recurrence) |
| PATCH | `/calendar/tasks/:id` | Update task |
| DELETE | `/calendar/tasks/:id` | Delete task |
| GET | `/calendar/player/:playerId` | Full calendar: slots + tasks |

### Lessons endpoints (`/lessons`)

| Method | Path | Notes |
|---|---|---|
| GET | `/lessons` | Filtered list (status, focusArea, subCapability, visibility) |
| GET | `/lessons/players` | Coach's players (for dropdowns) |
| POST | `/lessons` | Create lesson |
| GET | `/lessons/:id` | Get single lesson |
| PATCH | `/lessons/:id` | Update lesson |
| DELETE | `/lessons/:id` | Delete lesson |

### Development Plans endpoints (`/development-plans`)

| Method | Path | Notes |
|---|---|---|
| GET | `/development-plans/my-plans` | Coach: all plans; Player: own plans |
| GET | `/development-plans/player/:playerId` | Plans for a player |
| GET | `/development-plans/team/:teamId` | Plans for a team |
| POST | `/development-plans` | Create plan |
| PATCH | `/development-plans/:id` | Update plan metadata |
| DELETE | `/development-plans/:id` | Delete plan + cascade |
| POST | `/development-plans/:planId/blocks` | Add training block |
| PATCH | `/development-plans/blocks/:blockId` | Update block |
| DELETE | `/development-plans/blocks/:blockId` | Delete block + cascade |
| POST | `/development-plans/blocks/:blockId/assignments` | Assign lesson |
| PATCH | `/development-plans/assignments/:assignmentId` | Update assignment |
| DELETE | `/development-plans/assignments/:assignmentId` | Remove assignment |

---

## `apps/web/` – Next.js Frontend

### Route groups

| Group | Layout | Routes |
|---|---|---|
| `(public)` | Minimal | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| `(app)` | `HeaderAndSidebarLayout` | All authenticated pages |

### Page files (`apps/web/app/(app)/`)

| Route | File | Description |
|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Role-specific dashboard tiles |
| `/coach/players` | `coach/players/page.tsx` | Coach's player grid |
| `/coach/players/[playerId]` | `coach/players/[playerId]/page.tsx` | Player detail |
| `/coach/players/[playerId]/planning` | `…/planning/page.tsx` | Player's development plan |
| `/coach/players/[playerId]/calendar` | `…/calendar/page.tsx` | Player's calendar (coach view) |
| `/coach/lessons` | `coach/lessons/page.tsx` | Lesson library |
| `/coach/lessons/new` | `coach/lessons/new/page.tsx` | Create lesson |
| `/coach/lessons/[id]` | `coach/lessons/[id]/page.tsx` | Edit lesson |
| `/coach` | `coach/page.tsx` | Coach home |
| `/player` | `player/page.tsx` | Player home |
| `/calendar` | `calendar/page.tsx` | FullCalendar view |
| `/teams` | `teams/page.tsx` | Team management |
| `/planning` | `planning/page.tsx` | Planning hub |
| `/training-windows` | `training-windows/page.tsx` | Training window scheduling |
| `/club` | `club/page.tsx` | Club view |
| `/club/admins` | `club/admins/page.tsx` | Club admin management |
| `/settings` | `settings/page.tsx` | Settings hub |
| `/settings/general-data` | `settings/general-data/page.tsx` | Profile fields |
| `/settings/personal` | `settings/personal/page.tsx` | Clubs & coaches |
| `/settings/profile` | `settings/profile/page.tsx` | Avatar & bio |
| `/settings/notifications` | `settings/notifications/page.tsx` | Notification prefs |
| `/settings/users-auth` | `settings/users-auth/page.tsx` | Admin: user management |

### Next.js API proxy routes (`apps/web/app/api/`)

Proxies all browser requests to the NestJS backend. Mirrors the API structure:

```
app/api/
├── auth/             (login, signup, forgot, reset, me)
├── clubs/
├── teams/
├── users/
├── calendar/
├── lessons/
├── development-plans/
├── gamification/
├── players/
└── upload/
```

### Key component files (`apps/web/components/`)

| File | Purpose |
|---|---|
| `HeaderAndSidebarLayout.tsx` | App shell with sidebar + header |
| `sidebar.tsx` | Role-filtered nav links |
| `LessonForm.tsx` | Full create/edit form for `TrainingLesson` |
| `DevelopmentPlanManager.tsx` | Plan/block/assignment UI with drag-and-drop |
| `CoachPlanningBoard.tsx` | Multi-player planning board |
| `PlayerJourney.tsx` | Visual plan progress for player |
| `PracticeSlotDialog.tsx` | Create/edit `PracticeSlot` |
| `AssignTaskDialog.tsx` | Assign `CalendarTask` to a slot |
| `TrainingWindowDialog.tsx` | Create/edit training window |
| `PlayerCalendarView.tsx` | FullCalendar player view |
| `CoachPlayerCalendarView.tsx` | FullCalendar coach-viewing-player |
| `GamificationStats.tsx` | XP, level, streak display |
| `player-capabilities-widget.tsx` | Skill-area visualisation |
| `VideoUploadField.tsx` | Video URL attachment field |
| `LessonStatusBadge.tsx` | Colour-coded status badge |

### Key library files (`apps/web/lib/`)

| File | Purpose |
|---|---|
| `types.ts` | Shared TS types (CalendarEvent, TaskTemplate) |
| `lesson-types.ts` | Lesson enums, FOCUS_AREAS, LOCATIONS, helper fns |
| `player-capabilities.ts` | CAPABILITY_DEFINITIONS skill tree |
| `api.ts` | Fetch wrapper for client-side API calls |
| `auth-cookies.ts` | Cookie read/write helpers |
| `calendar-activity.ts` | Calendar activity helpers |
| `email.ts` | Resend email sending |
| `jwt.ts` | JWT sign/verify helpers |
| `prisma.ts` | Prisma client singleton for SSR |
| `utils.ts` | General utilities (cn, etc.) |

---

## `.github/workflows/`

| File | Trigger | Purpose |
|---|---|---|
| `epic-1-dashboard-redesign.yml` | PR | Validates dashboard component + lints only dashboard files |
| `epic-2-planning-style-validation.yml` | PR | Validates planning/dashboard UI changes |
| `epic-3-journey-experience-validation.yml` | PR | Validates Journey UI with targeted ESLint |
| `epic-4-gamification-foundation-validation.yml` | PR | Validates gamification foundation changes |
| `epic-*-review-checklist.yml` | PR | Posts review checklists as PR comments |

---

## Environment Variables (summary)

### API (`apps/api`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN |
| `ACCESS_SECRET` | Yes | JWT access token secret (≥32 chars) |
| `REFRESH_SECRET` | Yes | JWT refresh token secret (≥32 chars) |
| `FRONTEND_URL` | No | CORS allowed origin |
| `RESEND_API_KEY` | No | Email for invitations |
| `APP_URL` | No | Public URL in invite emails |

### Web (`apps/web`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL DSN (Prisma SSR) |
| `ACCESS_SECRET` | Yes | Token verification in middleware |
| `API_URL` | No | Internal NestJS URL (server-side proxy) |
| `NEXT_PUBLIC_API_URL` | No | Public-facing API URL |
| `SECURE_COOKIES` | No | Set `true` for HTTPS |
| `RESEND_API_KEY` | No | Email for password-reset |
