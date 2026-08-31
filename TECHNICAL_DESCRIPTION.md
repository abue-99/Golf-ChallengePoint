# Golf ChallengePoint – Full Functional & Technical Description

> **Purpose of this document**: A comprehensive reference for AI-assisted feature development and logic changes. It describes every functional area, data model, API endpoint, frontend page, and architectural decision in the application.

---

## 1. Application Overview

**Golf ChallengePoint** is a web-based golf coaching platform that connects coaches with players (individually and in teams). Coaches can design training lessons, build structured development plans, schedule practice slots, and track player progress. Players can view their schedules, complete assigned lessons, and record self-assessments. Administrators manage clubs and user accounts.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Monorepo tooling** | pnpm workspaces + Turborepo |
| **Backend API** | NestJS 11 (Node.js), TypeScript |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Database ORM** | Prisma 7, PostgreSQL |
| **Authentication** | JWT (access token in memory + refresh token in httpOnly cookie) |
| **UI components** | shadcn/ui, Radix UI, Tailwind CSS v4 |
| **Calendar widget** | FullCalendar v6 |
| **Data fetching (web)** | TanStack React Query + SWR |
| **Email** | Resend SDK |
| **Reverse proxy** | Caddy 2 |
| **Containerisation** | Docker + Docker Compose |

### Workspace Structure

```
/
├── apps/
│   ├── api/          # NestJS backend (port 4000)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   └── db/           # Shared Prisma client and schema
├── docker-compose.yml
├── Caddyfile
└── turbo.json
```

---

## 3. Data Model (Prisma / PostgreSQL)

### 3.1 Enumerations

| Enum | Values |
|---|---|
| `Role` | `PLAYER`, `COACH`, `ADMIN`, `SYSADMIN` |
| `Recurrence` | `NONE`, `DAILY`, `WEEKLY`, `MONTHLY` |
| `OwnerType` | `PLAYER`, `TEAM` |
| `LessonFocusArea` | `SETUP`, `PUTTING`, `SHORT_GAME`, `LONG_GAME`, `TACTICAL`, `FITNESS`, `MENTAL` |
| `LessonStatus` | `PLANNED`, `IN_PROGRESS`, `COMPLETED` |
| `LessonVisibility` | `PUBLIC`, `PRIVATE` |
| `LessonPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `GoalAchieved` | `YES`, `PARTIALLY`, `NO` |
| `AssignmentStatus` | `OUTSTANDING`, `STARTED`, `FINISHED`, `REVIEWED` |

### 3.2 Models

#### `User`
Central identity record. All roles share this table.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `email` | String (unique) | Lowercased on write |
| `passwordHash` | String | bcrypt, cost 10 |
| `firstName`, `lastName` | String? | |
| `profileImage` | String? | URL or base64 |
| `name` | String? | Display name (legacy) |
| `gender`, `phoneNumber`, `timezone`, `country` | String? | |
| `role` | `Role` | default `PLAYER` |
| `lastLogin` | DateTime? | Updated on login |
| `createdAt`, `updatedAt` | DateTime | |

Relations: `playerProfile`, `coachPlayerLinks` (as coach), `playerCoachLinks` (as player), `userClubs`, `coachTeams`, `teamMemberships`, `practiceSlots`, `coachTasks`, `coachLessons`, `playerLessons`, `coachDevelopmentPlans`, `playerDevelopmentPlans`, `coachTrainingBlocks`, `lessonAssignments`.

#### `Club`
A golf club organisation that groups coaches and players.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `shortId` | String? (unique) | Human-readable short code |
| `name` | String (unique) | |
| `city`, `country` | String? | |
| `createdAt` | DateTime | |

Relations: `userClubs` (membership), `teams`.

#### `UserClub`
Many-to-many join between `User` and `Club`.

#### `Team`
A group of players managed by a coach, optionally associated with a `Club`.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `icon` | String? | Emoji or icon identifier |
| `shortName` | String | Display name |
| `description` | String? | |
| `category` | String | Grouping label (e.g., age group) |
| `coachId` | FK → `User` | Owner/coach |
| `clubId` | FK → `Club`? | Optional club association |

Relations: `members` (TeamMember), `practiceSlots`, `developmentPlans`.

#### `TeamMember`
Many-to-many join between `Team` and `User`.

#### `PasswordResetToken`
Temporary one-time token for the forgot-password flow (expires in 1 hour).

#### `PlayerProfile`
Extended profile data for players (currently stores `name` and `handicap`).

#### `CoachPlayerLink`
Explicit many-to-many between coach `User` and player `User`, enabling a coach to track multiple players and a player to have multiple coaches.

Unique constraint: `(coachId, playerId)`.

#### `TaskTemplate`
Reusable task template with `title` and `content`.

#### `Challenge`
Simple entity storing challenge definitions (title only).

#### `PracticeSlot`
A scheduled time block on a player's or team's calendar.

| Field | Type | Notes |
|---|---|---|
| `ownerType` | `OwnerType` | `PLAYER` or `TEAM` |
| `playerId` | FK? | Set when `ownerType = PLAYER` |
| `teamId` | FK? | Set when `ownerType = TEAM` |
| `title` | String | |
| `startTime`, `endTime` | DateTime | |
| `recurrence` | `Recurrence` | Repeating schedule |
| `recurrenceEndDate` | DateTime? | |

Relations: `tasks` (CalendarTask).

#### `CalendarTask`
A specific coaching task assigned to a practice slot.

| Field | Type | Notes |
|---|---|---|
| `practiceSlotId` | FK | Parent slot |
| `coachId` | FK | Assigning coach |
| `title`, `description` | String | |
| `durationMinutes` | Int | |
| `scheduledDate` | DateTime | |

#### `TrainingLesson`
The core coaching content unit. Represents a single lesson with full lifecycle tracking.

**General information**: `name`, `description`, `durationMinutes`, `focusArea` (enum), `subCapability`, `subSubCapability`, `location`, `status`, `visibility`, `videoUrl`.

**Ownership**: `coachId` (required), `playerId` (optional), `teamId` (optional string, not a FK).

**Goal setting**: `trainingObjective`, `currentSituation`, `targetOutcome`, `priority`, `plannedExercises`, `successCriteria`.

**Results & performance tracking**: `goalAchieved`, `playerSelfAssessment` (1–10), `coachRating` (1–10), `afterSessionVideoUrl`, `performanceScore`, `comments`, `keyLearnings`.

Relations: `assignments` (LessonAssignment).

#### `PlayerDevelopmentPlan`
A long-form plan that groups `TrainingBlock`s for a player or team.

| Field | Type | Notes |
|---|---|---|
| `name`, `description` | String | |
| `coachId` | FK | Author coach |
| `ownerType` | `OwnerType` | |
| `playerId`, `teamId` | FK? | Depends on `ownerType` |
| `startDate`, `endDate` | DateTime? | |

Relations: `blocks`.

#### `TrainingBlock`
A phase or section within a `PlayerDevelopmentPlan`. Contains ordered `LessonAssignment`s.

| Field | Type | Notes |
|---|---|---|
| `planId` | FK | Parent plan |
| `coachId` | FK | Author coach |
| `name`, `description`, `goal` | String | |
| `startDate`, `endDate` | DateTime? | |
| `sortOrder` | Int | Display ordering (default 0) |

#### `LessonAssignment`
Junction record linking a `TrainingLesson` to a `TrainingBlock` for a specific player.

| Field | Type | Notes |
|---|---|---|
| `blockId` | FK | Parent block |
| `lessonId` | FK | Assigned lesson |
| `playerId` | FK | Assigned player |
| `coachId` | String | Assigning coach (not FK) |
| `dueDate` | DateTime? | |
| `priority` | `LessonPriority` | default `MEDIUM` |
| `status` | `AssignmentStatus` | default `OUTSTANDING` |
| `sortOrder` | Int | default 0 |
| `playerNotes` | String? | |
| `selfAssessment` | Int? | Player 1–10 rating |

---

## 4. Backend API (`apps/api`)

### 4.1 Architecture

NestJS with the following modules:

- `PrismaModule` – singleton Prisma client
- `AuthModule` – JWT strategy, guards, password flows
- `ClubsModule` – club CRUD
- `TeamsModule` – team management
- `UsersModule` – user management and coach/player linking
- `CalendarModule` – practice slots and calendar tasks
- `LessonsModule` – training lessons CRUD
- `DevelopmentPlansModule` – plans, blocks, and lesson assignments

Base URL: `http://localhost:4000` (or proxied via Caddy at `/api`).

Global settings:
- CORS configured for the frontend origin (env `FRONTEND_URL`)
- JSON body limit: 5 MB
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- `cookie-parser` middleware for refresh tokens

### 4.2 Authentication (`/auth`)

**Strategy**: Passport JWT. The JWT payload contains `{ sub, email, role }`.

**Tokens**:
- Access token: short-lived (default 15 min), returned in the JSON response body.
- Refresh token: long-lived (default 7 days), stored in an httpOnly `SameSite=Strict` cookie named `refresh_token`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | Public | Register new user (role defaults to `PLAYER`). Returns `{ accessToken, user }`. Sets refresh cookie. |
| POST | `/auth/login` | Public | Authenticate. Returns `{ accessToken, user }`. Sets refresh cookie. |
| POST | `/auth/refresh` | Cookie | Exchange refresh cookie for a new access token. Rotates refresh token. |
| POST | `/auth/logout` | JWT | Clears the refresh cookie. |
| GET | `/auth/me` | JWT | Returns full user profile from DB. |
| GET | `/auth/profile` | JWT | Same as `/auth/me`. |
| PATCH | `/auth/profile` | JWT | Update `firstName`, `lastName`, `profileImage`, `gender`, `phoneNumber`, `timezone`, `country`, `role`. |
| POST | `/auth/forgot` | Public | Creates a password-reset token (1 h TTL). Logs the reset URL (email not yet sent here). |
| POST | `/auth/reset` | Public | Validates token, hashes and saves new password, deletes token. |
| POST | `/auth/change-password` | JWT | Verifies current password, sets new password (min 8 chars). |

### 4.3 Clubs (`/clubs`)

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/clubs/public` | Public | Any | List all clubs (used by signup form). |
| GET | `/clubs` | JWT | Any | List all clubs. |
| POST | `/clubs` | JWT | `SYSADMIN` | Create a club. Body: `{ name, shortId?, city?, country? }`. |
| PATCH | `/clubs/:id` | JWT | `SYSADMIN` | Update club fields. |
| DELETE | `/clubs/:id` | JWT | `SYSADMIN` | Delete a club. |
| GET | `/clubs/my` | JWT | Any | Get clubs the current user belongs to. |
| POST | `/clubs/my` | JWT | Any | Add current user to a club. Body: `{ clubId }`. |
| DELETE | `/clubs/my/:clubId` | JWT | Any | Remove current user from a club. |

### 4.4 Teams (`/teams`)

All endpoints require JWT + role `COACH` or `ADMIN`.

| Method | Path | Description |
|---|---|---|
| GET | `/teams` | List all teams owned by the current coach. |
| GET | `/teams/:id` | Get a single team with members. |
| GET | `/teams/categories` | Get distinct category labels used by this coach's teams. |
| GET | `/teams/club-players?clubId=` | List players from the coach's clubs (for adding to a team). |
| POST | `/teams` | Create a team. Body: `{ shortName, icon?, description?, category?, clubId? }`. |
| PATCH | `/teams/:id` | Update team metadata. |
| DELETE | `/teams/:id` | Delete team and cascade members. |
| POST | `/teams/:id/members` | Add a player to the team. Body: `{ userId }`. |
| DELETE | `/teams/:id/members/:userId` | Remove a player from the team. |

### 4.5 Users (`/users`)

| Method | Path | Auth Role | Description |
|---|---|---|---|
| GET | `/users` | `ADMIN` | List all users. |
| PATCH | `/users/:id/role` | `ADMIN` | Update a user's role. ADMINs can only assign `COACH` or `ADMIN`; `SYSADMIN` can assign any role. |
| PATCH | `/users/:id/profile` | `ADMIN` | Update `firstName`/`lastName`. |
| POST | `/users/:id/clubs` | `SYSADMIN` | Add a user to a club. |
| DELETE | `/users/:id/clubs/:clubId` | `SYSADMIN` | Remove a user from a club. |
| GET | `/users/:id/coaches` | `SYSADMIN` | Get coaches linked to a user. |
| GET | `/users/:id/available-coaches` | `SYSADMIN` | Coaches from shared clubs. |
| POST | `/users/:id/coaches/:coachId` | `SYSADMIN` | Link a coach to a user. |
| DELETE | `/users/:id/coaches/:coachId` | `SYSADMIN` | Unlink a coach from a user. |
| DELETE | `/users/:id` | `ADMIN` | Delete a user. |
| POST | `/users/invite` | `COACH` | Invite and create a new player. Body: `{ firstName, lastName, email, clubId }`. Sends invitation email. |
| GET | `/users/me/players` | JWT | Get players linked to the current coach. |
| GET | `/users/me/available-coaches` | JWT | Get coaches from shared clubs. |
| GET | `/users/me/coaches` | JWT | Get coaches currently linked to the user. |
| POST | `/users/me/coaches/:coachId` | JWT | Link a coach to the current user. |
| DELETE | `/users/me/coaches/:coachId` | JWT | Unlink a coach. |
| POST | `/users/me/players/:playerId` | `COACH` | Link an existing player to the coach. |
| DELETE | `/users/me/players/:playerId` | `COACH` | Unlink a player from the coach. |
| POST | `/users/:id/resend-invite` | `ADMIN` | Resend invitation email. |

### 4.6 Calendar (`/calendar`)

| Method | Path | Description |
|---|---|---|
| GET | `/calendar/slots?playerId=` | List practice slots. Coaches pass `playerId` to see a player's slots; players see their own. |
| POST | `/calendar/slots` | Create a personal practice slot (PLAYER only). Body: `{ title, startTime, endTime, recurrence?, recurrenceEndDate?, playerId? }`. |
| PATCH | `/calendar/slots/:id` | Update a slot (owner or coach). |
| DELETE | `/calendar/slots/:id` | Delete a slot. |
| GET | `/calendar/team-slots/:teamId` | List practice slots for a team. |
| POST | `/calendar/team-slots/:teamId` | Create a team practice slot (COACH/ADMIN). |
| GET | `/calendar/slots/:slotId/tasks` | List tasks in a slot. |
| POST | `/calendar/slots/:slotId/tasks` | Assign a task to a slot (COACH/ADMIN only). Supports `recurrenceCount` and `recurrenceWeeks` for bulk task generation. |
| PATCH | `/calendar/tasks/:id` | Update a task. |
| DELETE | `/calendar/tasks/:id` | Delete a task. |
| GET | `/calendar/player/:playerId` | Full calendar view for a player: slots + tasks. |

### 4.7 Lessons (`/lessons`)

| Method | Path | Description |
|---|---|---|
| GET | `/lessons?status=&focusArea=&subCapability=&subSubCapability=&visibility=` | List lessons. Coaches see their own; players see public lessons and ones assigned to them. Supports query filters. |
| GET | `/lessons/players` | List players linked to the current coach (for assignment dropdowns). |
| POST | `/lessons` | Create a lesson (full body – see data model for all fields). |
| GET | `/lessons/:id` | Get a single lesson. Access controlled: coach sees own; player sees if assigned or public. |
| PATCH | `/lessons/:id` | Update a lesson. |
| DELETE | `/lessons/:id` | Delete a lesson. |

### 4.8 Development Plans (`/development-plans`)

#### Plans

| Method | Path | Description |
|---|---|---|
| GET | `/development-plans/my-plans` | Coaches get all their plans; players get their own plans. |
| GET | `/development-plans/player/:playerId` | Get plans for a specific player (coach/admin access or player's own). |
| GET | `/development-plans/team/:teamId` | Get plans for a team. |
| POST | `/development-plans` | Create a plan. Body: `{ name, description?, playerId?, teamId?, startDate?, endDate? }`. |
| PATCH | `/development-plans/:id` | Update plan metadata. |
| DELETE | `/development-plans/:id` | Delete a plan and cascade blocks + assignments. |

#### Training Blocks

| Method | Path | Description |
|---|---|---|
| POST | `/development-plans/:planId/blocks` | Add a block to a plan. Body: `{ name, description?, goal?, startDate?, endDate?, sortOrder? }`. |
| PATCH | `/development-plans/blocks/:blockId` | Update block metadata or `sortOrder`. |
| DELETE | `/development-plans/blocks/:blockId` | Delete block and cascade assignments. |

#### Lesson Assignments

| Method | Path | Description |
|---|---|---|
| POST | `/development-plans/blocks/:blockId/assignments` | Assign a lesson to a block. Body: `{ lessonId, playerId, dueDate?, priority?, sortOrder? }`. |
| PATCH | `/development-plans/assignments/:assignmentId` | Update `status`, `dueDate`, `priority`, `sortOrder`, `playerNotes`, `selfAssessment`. |
| DELETE | `/development-plans/assignments/:assignmentId` | Remove an assignment. |

---

## 5. Frontend Application (`apps/web`)

### 5.1 Architecture

Next.js 16 App Router. Route groups:
- `(public)` – unauthenticated pages (login, signup, forgot/reset password)
- `(app)` – authenticated pages wrapped by `HeaderAndSidebarLayout`

Authentication is handled via JWT in localStorage (access token) + httpOnly cookie (refresh token). A Next.js middleware (`middleware.ts`) protects all `(app)` routes. The web app also exposes its own API proxy routes under `app/api/` that forward requests to the NestJS backend.

### 5.2 Page Map

#### Public Pages

| Route | Description |
|---|---|
| `/login` | Email + password login form. On success, stores access token and redirects to `/dashboard`. |
| `/signup` | Registration form. Picks a club from the public clubs list. Role defaults to `PLAYER`. |
| `/forgot-password` | Enter email to request a password-reset link. |
| `/reset-password?token=…` | Enter new password using the reset token. |

#### Authenticated Pages

| Route | Description |
|---|---|
| `/dashboard` | Home dashboard. Shows role-specific tiles: players (coaches see player count + team count), or a player home view with upcoming practice slots and assigned lessons. |
| `/coach/players` | Responsive avatar card grid of the coach's linked players. Amber dot for players who have never logged in. Double-click opens a detail modal. "+ Add User" button opens an invite dialog. |
| `/coach/lessons` | Library of all training lessons created by the coach. Filter by focus area, status, visibility. Create/edit lessons via `LessonForm`. |
| `/player` | Player's view of their assigned lessons and development plans. |
| `/calendar` | FullCalendar-powered view. Players see their own practice slots + assigned tasks. Coaches can view a player's calendar, create team slots, and assign tasks. |
| `/teams` | List of coach's teams. Create/edit teams and manage members. |
| `/planning` | Planning hub: `DevelopmentPlanManager` component for building/viewing player and team development plans with drag-and-drop blocks and lesson assignments. Also contains `CoachPlanningBoard`. |
| `/training-windows` | Training window scheduling view (`TrainingWindowsView` + `TeamTrainingWindowsView`). |
| `/club` | Club-specific views for the current user's clubs. |
| `/settings` | Tabbed settings area: **General** (profile data), **Personal** (clubs & coaches), **Profile** (avatar, bio), **Notifications** (placeholder), **Users/Auth** (admin: role changes, invites, delete), **Club Settings** (admin), **Club Admins** (sysadmin). |

### 5.3 Key Components

| Component | Purpose |
|---|---|
| `HeaderAndSidebarLayout` | Shell layout with collapsible sidebar and top header bar. |
| `sidebar.tsx` | Navigation links filtered by role. |
| `LessonForm` | Full form for creating/editing a `TrainingLesson`. Includes all goal-setting and results fields. |
| `DevelopmentPlanManager` | Manages plans, blocks, and lesson assignment drag-and-drop for a player or team. |
| `CoachPlanningBoard` | Board view for coach to plan across multiple players/teams. |
| `PlayerJourney` | Visual representation of a player's assigned plan and progress. |
| `PracticeSlotDialog` | Modal for creating/editing a `PracticeSlot`. |
| `AssignTaskDialog` | Modal for assigning a `CalendarTask` to a practice slot. |
| `TrainingWindowDialog` | Modal for creating/editing training windows. |
| `PlayerCalendarView` | FullCalendar player-facing calendar. |
| `CoachPlayerCalendarView` | FullCalendar calendar for coaches to view a specific player. |
| `VideoUploadField` | Field for attaching a video URL (before/after session). |
| `LessonStatusBadge` | Colour-coded badge showing `LessonStatus`. |
| `player-capabilities-widget` | Widget visualising a player's skill areas. |
| `theme-toggle.tsx` | Dark/light mode switch (`next-themes`). |

### 5.4 State Management & Data Fetching

- **TanStack React Query** and **SWR** for server-state caching, refetching, and mutations.
- All API calls go through the Next.js API proxy routes (`/app/api/…`) to avoid CORS from the browser.
- Access token is attached to every proxied request via the `Authorization: ****** header.
- Token refresh is handled automatically when a 401 is encountered.

---

## 6. Role & Permission Model

| Role | Capabilities |
|---|---|
| `PLAYER` | Register/login, view own calendar and practice slots, create own practice slots, view assigned lessons (public or assigned), complete lesson assignments, self-assess, update own profile and coach links. |
| `COACH` | All player capabilities + manage own players (invite, link/unlink), create/edit/delete own lessons, manage teams and team members, manage development plans and blocks, assign lessons, view player calendars and assign tasks. |
| `ADMIN` | All coach capabilities + list all users, change user roles (to `COACH`/`ADMIN` only), update user profiles, delete users, resend invites, manage club settings. |
| `SYSADMIN` | All admin capabilities + create/update/delete clubs, assign any role including `SYSADMIN`, manage club memberships for any user, manage coach links for any user. |

---

## 7. Infrastructure & Deployment

### Docker Compose Services

| Service | Image | Port | Description |
|---|---|---|---|
| `api` | `ghcr.io/abue-99/golf-api:latest` | 4000 | NestJS backend |
| `web` | `ghcr.io/abue-99/golf-web:latest` | 3000 | Next.js frontend |
| `caddy` | `caddy:2-alpine` | 80, 443 | Reverse proxy / TLS termination |

### Environment Variables

#### API service

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ACCESS_SECRET` | Yes | JWT signing secret for access tokens (min 32 chars) |
| `REFRESH_SECRET` | Yes | JWT signing secret for refresh tokens (min 32 chars) |
| `ACCESS_TOKEN_EXPIRY` | No (default `15m`) | Access token TTL |
| `REFRESH_TOKEN_EXPIRY` | No (default `7d`) | Refresh token TTL |
| `FRONTEND_URL` | No | CORS allowed origin |
| `RESEND_API_KEY` | No | Resend API key for invitation emails |
| `APP_URL` | No | Public URL embedded in invite email links |

#### Web service

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (used by Prisma in SSR) |
| `API_URL` | No | Internal URL to NestJS API (server-side proxy) |
| `NEXT_PUBLIC_API_URL` | No | Public-facing API URL |
| `ACCESS_SECRET` | Yes | Same secret as API (used for token verification in middleware) |
| `SECURE_COOKIES` | No (`false`) | Set `true` when serving over HTTPS |
| `RESEND_API_KEY` | No | Resend API key for password-reset emails |

### Reverse Proxy (Caddy)

Caddy routes traffic:
- `/api/*` → proxied to `golf_api:4000`
- `/*` → proxied to `golf_web:3000`
- Handles automatic HTTPS (Let's Encrypt) when `DOMAIN` is set to a real hostname.

---

## 8. Business Logic Details

### 8.1 Coach–Player Linking

A coach and player must be explicitly linked via `CoachPlayerLink` before the coach can view the player's calendar, assign lessons, or build development plans. Links can be created:
- By the coach via `POST /users/me/players/:playerId`
- By the player via `POST /users/me/coaches/:coachId`
- Automatically when a coach invites a new player (`POST /users/invite`)

### 8.2 Club Membership

Users join clubs via `UserClub`. The same club drives:
1. Which coaches are "available" to a player (coaches from the same club).
2. Which players appear in a coach's "club players" list for team membership.

### 8.3 Lesson Lifecycle

```
PLANNED → IN_PROGRESS → COMPLETED
```

A coach creates lessons (PLANNED). During or after delivery, the lesson can be updated to IN_PROGRESS and then COMPLETED. The coach sets `coachRating`, `goalAchieved`, `performanceScore`, `keyLearnings`, and `afterSessionVideoUrl`. The player sets `playerSelfAssessment` and `playerNotes` through the LessonAssignment record.

### 8.4 Development Plan Structure

```
PlayerDevelopmentPlan
  └─ TrainingBlock (ordered by sortOrder)
       └─ LessonAssignment (ordered by sortOrder)
            └─ TrainingLesson (referenced)
```

A plan can belong to a single player (`ownerType = PLAYER`) or a team (`ownerType = TEAM`). Team plans expose the same block/assignment structure, but assignments are created per-player from the team roster.

### 8.5 Calendar & Recurrence

Practice slots support `NONE`, `DAILY`, `WEEKLY`, and `MONTHLY` recurrence with an optional `recurrenceEndDate`. Calendar tasks within a slot can also be bulk-created across multiple recurrences using `recurrenceCount` + `recurrenceWeeks` parameters in the task-creation endpoint.

### 8.6 Invitation Flow

1. Coach calls `POST /users/invite` with `{ firstName, lastName, email, clubId }`.
2. The API creates a new `User` with role `PLAYER`, a random temporary password, and links the user to the specified club and to the inviting coach.
3. A `CoachPlayerLink` is created automatically.
4. An invitation email is sent via Resend with a login link containing the temporary credentials.
5. The admin can resend the invite via `POST /users/:id/resend-invite`.

### 8.7 Password Reset Flow

1. User submits their email to `POST /auth/forgot`.
2. A `PasswordResetToken` record is created with a random 32-byte hex token and a 1-hour expiry.
3. The reset URL is sent via the Next.js web layer using Resend.
4. User submits the token + new password to `POST /auth/reset`.
5. The token is validated (existence + expiry), password is hashed and saved, token record is deleted.

---

## 9. Key Design Patterns

- **Role guard on every API endpoint** – `JwtAuthGuard` validates the JWT; `RolesGuard` + `@Roles(...)` decorator restricts by role.
- **`@CurrentUser()` decorator** – injects `{ id, email, role }` from the JWT into any controller method.
- **Prisma cascades** – child records (team members, plan blocks, assignments) are automatically deleted when parents are deleted (`onDelete: Cascade`).
- **`OwnerType` enum** – reused across `PracticeSlot` and `PlayerDevelopmentPlan` to share the same structure for both individual-player and team-owned entities.
- **Proxy API routes in Next.js** – the browser never calls the NestJS API directly; all requests are proxied through Next.js to avoid CORS issues and to allow server-side token injection.
- **Soft player visibility** – lessons have a `visibility` field (`PUBLIC`/`PRIVATE`); public lessons are visible to all players, private lessons only to the assigned player or the owning coach.

---

## 10. Development Setup

```bash
# Install dependencies
pnpm install

# Start all services locally
pnpm dev

# OR start with Docker
docker compose up --build
```

API runs on `http://localhost:4000`, web on `http://localhost:3000`.

Database migrations are managed via Prisma (`packages/db/prisma/migrations`). Seed data is available in `packages/db/prisma/seed.ts`.
