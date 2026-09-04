# Domain Model – Golf ChallengePoint

> Canonical reference for all database entities, enumerations, and their relationships.  
> Source of truth: `packages/db/prisma/schema.prisma`  
> See `docs/ai-context.md` for project overview and `docs/repository-map.md` for file locations.

---

## Enumerations

| Enum                         | Values                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `Role`                       | `PLAYER` · `COACH` · `ADMIN` · `SYSADMIN`                                            |
| `Recurrence`                 | `NONE` · `DAILY` · `WEEKLY` · `MONTHLY`                                              |
| `OwnerType`                  | `PLAYER` · `TEAM`                                                                    |
| `LessonFocusArea`            | `SETUP` · `PUTTING` · `SHORT_GAME` · `LONG_GAME` · `TACTICAL` · `FITNESS` · `MENTAL` |
| `LessonStatus`               | `PLANNED` · `IN_PROGRESS` · `COMPLETED`                                              |
| `LessonVisibility`           | `PUBLIC` · `PRIVATE`                                                                 |
| `LessonPriority`             | `LOW` · `MEDIUM` · `HIGH`                                                            |
| `GoalAchieved`               | `YES` · `PARTIALLY` · `NO`                                                           |
| `AssignmentStatus`           | `NEW` · `OPEN` · `IN_PROGRESS` · `COMPLETED` · `ARCHIVED`                            |
| `AssignmentTargetType`       | `PLAYER` · `TEAM` · `GROUP`                                                          |
| `AssignmentSourceType`       | `PLAYER` · `TEAM` · `GROUP`                                                          |
| `JourneyDifficulty`          | `BEGINNER` · `INTERMEDIATE` · `ADVANCED`                                             |
| `JourneyVisibility`          | `PUBLIC` · `PRIVATE`                                                                 |
| `CalendarTaskStatus`         | `PLANNED` · `COMPLETED`                                                              |
| `AvailabilityBlockType`      | `SCHOOL` · `WORK` · `HOLIDAY` · `TRAVEL` · `CUSTOM`                                  |
| `TournamentPriority`         | `PRIORITY_1` · `PRIORITY_2` · `PRIORITY_3`                                           |
| `DevelopmentMilestoneStatus` | `PLANNED` · `COMPLETED`                                                              |

---

## Entity Reference

### `User` (table: `users`)

Central identity record. All roles share this table.

| Field          | Type            | Notes               |
| -------------- | --------------- | ------------------- |
| `id`           | String (cuid)   | PK                  |
| `email`        | String (unique) | Lowercased on write |
| `passwordHash` | String          | bcrypt cost 10      |
| `firstName`    | String?         |                     |
| `lastName`     | String?         |                     |
| `profileImage` | String?         | URL                 |
| `name`         | String?         | Legacy display name |
| `gender`       | String?         |                     |
| `phoneNumber`  | String?         |                     |
| `timezone`     | String?         |                     |
| `country`      | String?         |                     |
| `role`         | `Role`          | default `PLAYER`    |
| `lastLogin`    | DateTime?       | Updated on login    |
| `createdAt`    | DateTime        | auto                |
| `updatedAt`    | DateTime        | auto                |

**Relations (outgoing)**  
`playerProfile` · `coachPlayerLinks` (as coach) · `playerCoachLinks` (as player) · `userClubs` · `coachTeams` · `teamMemberships` · `practiceSlots` (as player) · `coachTasks` · `coachLessons` · `playerLessons` · `coachDevelopmentPlans` · `playerDevelopmentPlans` · `coachTrainingBlocks` · `lessonAssignments` · `availabilityBlocks` · `tournaments` · `teamEvents`

---

### `PlayerProfile` (table: `player_profiles`)

Extended profile for players. One-to-one with `User`.

| Field            | Type                      | Notes                            |
| ---------------- | ------------------------- | -------------------------------- |
| `id`             | String (cuid)             | PK                               |
| `userId`         | String (unique FK → User) |                                  |
| `name`           | String                    | Display name                     |
| `handicap`       | Float?                    | Golf handicap                    |
| `xp`             | Int                       | default 0 – gamification XP      |
| `level`          | Int                       | default 1 – gamification level   |
| `currentStreak`  | Int                       | default 0 – active streak (days) |
| `longestStreak`  | Int                       | default 0                        |
| `lastActivityAt` | DateTime?                 | Last activity for streak calc    |
| `createdAt`      | DateTime                  | auto                             |
| `updatedAt`      | DateTime                  | auto                             |

---

### `Club` (table: `clubs`)

A golf club that groups coaches and players.

| Field       | Type             | Notes                     |
| ----------- | ---------------- | ------------------------- |
| `id`        | String (cuid)    | PK                        |
| `shortId`   | String? (unique) | Human-readable short code |
| `name`      | String (unique)  |                           |
| `city`      | String?          |                           |
| `country`   | String?          |                           |
| `createdAt` | DateTime         | auto                      |

**Relations**: `userClubs` (members) · `teams`

---

### `UserClub` (table: `user_clubs`)

Many-to-many join: `User` ↔ `Club`.  
Unique constraint: `(userId, clubId)`.

---

### `Team` (table: `teams`)

A group of players managed by one coach, optionally inside a `Club`.

| Field         | Type          | Notes                            |
| ------------- | ------------- | -------------------------------- |
| `id`          | String (cuid) | PK                               |
| `icon`        | String?       | Emoji identifier                 |
| `shortName`   | String        | Display name                     |
| `description` | String?       |                                  |
| `category`    | String        | Grouping label (e.g., age group) |
| `coachId`     | FK → User     | Owner                            |
| `clubId`      | FK → Club?    | Optional club                    |
| `createdAt`   | DateTime      | auto                             |
| `updatedAt`   | DateTime      | auto                             |

**Relations**: `members` (TeamMember) · `practiceSlots` · `developmentPlans` · `events` (TeamEvent)

---

### `TeamMember` (table: `team_members`)

Many-to-many join: `Team` ↔ `User`.  
Unique constraint: `(teamId, userId)`.

---

### `CoachPlayerLink` (table: `coach_player_links`)

Explicit coach↔player relationship. Must exist before a coach can assign lessons or view a player's calendar.  
Unique constraint: `(coachId, playerId)`.

| Field       | Type          | Notes |
| ----------- | ------------- | ----- |
| `id`        | String (cuid) | PK    |
| `coachId`   | FK → User     |       |
| `playerId`  | FK → User     |       |
| `createdAt` | DateTime      | auto  |

---

### `PasswordResetToken` (table: `password_reset_tokens`)

One-time token for the forgot-password flow. Expires in 1 hour.

| Field       | Type            | Notes             |
| ----------- | --------------- | ----------------- |
| `id`        | String (cuid)   | PK                |
| `email`     | String          | Matched to user   |
| `token`     | String (unique) | Secure random     |
| `expiresAt` | DateTime        | 1 h from creation |
| `createdAt` | DateTime        | auto              |

---

### `PracticeSlot` (table: `practice_slots`)

A scheduled time block on a player's or team's calendar. Can recur.

| Field               | Type          | Notes                         |
| ------------------- | ------------- | ----------------------------- |
| `id`                | String (cuid) | PK                            |
| `ownerType`         | `OwnerType`   | `PLAYER` or `TEAM`            |
| `playerId`          | FK → User?    | Set when `ownerType = PLAYER` |
| `teamId`            | FK → Team?    | Set when `ownerType = TEAM`   |
| `title`             | String        |                               |
| `startTime`         | DateTime      |                               |
| `endTime`           | DateTime      |                               |
| `recurrence`        | `Recurrence`  | default `NONE`                |
| `recurrenceEndDate` | DateTime?     |                               |
| `createdAt`         | DateTime      | auto                          |
| `updatedAt`         | DateTime      | auto                          |

**Relations**: `tasks` (CalendarTask)

---

### `CalendarTask` (table: `calendar_tasks`)

A specific coaching task assigned to a `PracticeSlot`.

| Field             | Type                 | Notes                     |
| ----------------- | -------------------- | ------------------------- |
| `id`              | String (cuid)        | PK                        |
| `practiceSlotId`  | FK → PracticeSlot    |                           |
| `coachId`         | FK → User            | Assigning coach           |
| `title`           | String               |                           |
| `description`     | String               |                           |
| `durationMinutes` | Int                  |                           |
| `scheduledDate`   | DateTime             |                           |
| `status`          | `CalendarTaskStatus` | default `PLANNED`         |
| `completedAt`     | DateTime?            |                           |
| `lessonId`        | FK → TrainingLesson? | Optional link to a lesson |
| `createdAt`       | DateTime             | auto                      |
| `updatedAt`       | DateTime             | auto                      |

---

### `TrainingLesson` (table: `training_lessons`)

Core coaching content unit. Full lifecycle from planning to post-session review.

**General information**

| Field              | Type               | Notes                              |
| ------------------ | ------------------ | ---------------------------------- |
| `id`               | String (cuid)      | PK                                 |
| `name`             | String             |                                    |
| `description`      | String?            |                                    |
| `durationMinutes`  | Int                |                                    |
| `focusArea`        | `LessonFocusArea`  |                                    |
| `subCapability`    | String?            | Sub-area within focusArea          |
| `subSubCapability` | String?            | Nested sub-area                    |
| `location`         | String?            | See LOCATIONS in `lesson-types.ts` |
| `status`           | `LessonStatus`     | default `PLANNED`                  |
| `visibility`       | `LessonVisibility` | default `PRIVATE`                  |
| `videoUrl`         | String?            | Pre-session video                  |

**Ownership**

| Field      | Type       | Notes                           |
| ---------- | ---------- | ------------------------------- |
| `coachId`  | FK → User  | Required                        |
| `playerId` | FK → User? | Optional; assigned player       |
| `teamId`   | String?    | Not a FK; team reference string |

**Goal setting**

| Field               | Type              |
| ------------------- | ----------------- |
| `trainingObjective` | String?           |
| `currentSituation`  | String?           |
| `targetOutcome`     | String?           |
| `priority`          | `LessonPriority`? |
| `plannedExercises`  | String?           |
| `successCriteria`   | String?           |

**Results & performance tracking**

| Field                  | Type            | Notes              |
| ---------------------- | --------------- | ------------------ |
| `goalAchieved`         | `GoalAchieved`? |                    |
| `playerSelfAssessment` | Int?            | 1–10               |
| `coachRating`          | Int?            | 1–10               |
| `afterSessionVideoUrl` | String?         | Post-session video |
| `performanceScore`     | Int?            | Computed score     |
| `comments`             | String?         |                    |
| `keyLearnings`         | String?         |                    |

**Relations**: `assignments` (LessonAssignment) · `calendarTasks` (CalendarTask)

---

### `PlayerDevelopmentPlan` (table: `player_development_plans`)

A long-form structured plan with multiple training blocks, for one player or a team.

| Field         | Type          | Notes                         |
| ------------- | ------------- | ----------------------------- |
| `id`          | String (cuid) | PK                            |
| `name`        | String        |                               |
| `description` | String?       |                               |
| `coachId`     | FK → User     | Author                        |
| `ownerType`   | `OwnerType`   | `PLAYER` or `TEAM`            |
| `playerId`    | FK → User?    | Set when `ownerType = PLAYER` |
| `teamId`      | FK → Team?    | Set when `ownerType = TEAM`   |
| `startDate`   | DateTime?     |                               |
| `endDate`     | DateTime?     |                               |
| `createdAt`   | DateTime      | auto                          |
| `updatedAt`   | DateTime      | auto                          |

**Relations**: `blocks` (TrainingBlock) · `milestones` (DevelopmentPlanMilestone)

---

### `TrainingBlock` (table: `training_blocks`)

A phase or section within a `PlayerDevelopmentPlan`. Contains ordered lesson assignments.

| Field         | Type                       | Notes            |
| ------------- | -------------------------- | ---------------- |
| `id`          | String (cuid)              | PK               |
| `planId`      | FK → PlayerDevelopmentPlan |                  |
| `coachId`     | FK → User                  |                  |
| `name`        | String                     |                  |
| `description` | String?                    |                  |
| `goal`        | String?                    | Block-level goal |
| `startDate`   | DateTime?                  |                  |
| `endDate`     | DateTime?                  |                  |
| `sortOrder`   | Int                        | default 0        |
| `createdAt`   | DateTime                   | auto             |
| `updatedAt`   | DateTime                   | auto             |

**Relations**: `assignments` (LessonAssignment) · `milestones` (DevelopmentPlanMilestone)

---

### `LessonAssignment` (table: `lesson_assignments`)

Reusable assignment/queue record. It can belong to a `TrainingBlock`, or exist standalone as a direct coach assignment into the training queue.

| Field               | Type                            | Notes                                                        |
| ------------------- | ------------------------------- | ------------------------------------------------------------ |
| `id`                | String (cuid)                   | PK                                                           |
| `blockId`           | FK → TrainingBlock?             | Optional when created outside a development plan             |
| `lessonId`          | FK → TrainingLesson             |                                                              |
| `targetType`        | `AssignmentTargetType`          | default `PLAYER`                                             |
| `sourceType`        | `AssignmentSourceType`          | default `PLAYER`                                             |
| `sourceReference`   | String?                         | Player/team/group identifier used to track origin            |
| `playerId`          | FK → User?                      | Assigned player when resolved to an individual queue item    |
| `teamId`            | FK → Team?                      | Optional originating team                                    |
| `groupName`         | String?                         | Optional group label                                         |
| `coachId`           | FK → User                       | Assigning coach                                              |
| `dueDate`           | DateTime?                       |                                                              |
| `isInTrainingQueue` | Boolean                         | default `false`; direct coach assignment sets this to `true` |
| `teamEventId`       | FK → TeamEvent?                 | Optional link to a team event                                |
| `calendarTaskId`    | via `CalendarTask.assignmentId` | Optional scheduled task linkage                              |
| `priority`          | `LessonPriority`                | default `MEDIUM`                                             |
| `status`            | `AssignmentStatus`              | default `NEW`                                                |
| `sortOrder`         | Int                             | default 0                                                    |
| `playerNotes`       | String?                         |                                                              |
| `selfAssessment`    | Int?                            | Player 1–10 rating                                           |
| `createdAt`         | DateTime                        | auto                                                         |
| `updatedAt`         | DateTime                        | auto                                                         |

**Operational notes**

- Direct assignment to a single player creates one queue-backed `LessonAssignment`.
- Direct assignment to a team resolves all active members and creates one separate `LessonAssignment` per member.
- Team pending counters in the coach UI are aggregates of each member's open queue-backed assignments; they are not stored on the `Team` row itself.

---

### `JourneyTemplate` (table: `journey_templates`)

Reusable multi-lesson coaching program authored by a coach.

| Field           | Type                 | Notes                  |
| --------------- | -------------------- | ---------------------- |
| `id`            | String (cuid)        | PK                     |
| `coachId`       | FK → User            | Author                 |
| `name`          | String               |                        |
| `description`   | String?              |                        |
| `category`      | String?              |                        |
| `difficulty`    | `JourneyDifficulty`? |                        |
| `visibility`    | `JourneyVisibility`  | default `PRIVATE`      |
| `coverImageUrl` | String?              | Optional cover image   |
| `createdAt`     | DateTime             | auto                   |
| `updatedAt`     | DateTime             | auto                   |

**Relations**: `lessons` (JourneyTemplateLesson) · `assignments` (JourneyTemplateAssignment)

---

### `JourneyTemplateLesson` (table: `journey_template_lessons`)

Ordered join table between a `JourneyTemplate` and its lessons.

| Field               | Type                | Notes             |
| ------------------- | ------------------- | ----------------- |
| `id`                | String (cuid)       | PK                |
| `journeyTemplateId` | FK → JourneyTemplate |                 |
| `lessonId`          | FK → TrainingLesson |                  |
| `sortOrder`         | Int                 | default `0`       |
| `isRequired`        | Boolean             | default `false`   |
| `createdAt`         | DateTime            | auto              |
| `updatedAt`         | DateTime            | auto              |

---

### `JourneyTemplateAssignment` (table: `journey_template_assignments`)

Queue-backed assignment created when a coach assigns a journey to a player or team.

| Field               | Type                  | Notes                                                       |
| ------------------- | --------------------- | ----------------------------------------------------------- |
| `id`                | String (cuid)         | PK                                                          |
| `journeyTemplateId` | FK → JourneyTemplate  |                                                            |
| `playerId`          | FK → User             | Target player                                               |
| `teamId`            | FK → Team?            | Source team when assigned at team level                     |
| `coachId`           | FK → User             | Assigning coach                                             |
| `playerPlanId`      | String                | Links the queued journey back to the generated player plan  |
| `status`            | `AssignmentStatus`    | default `NEW`                                               |
| `isInTrainingQueue` | Boolean               | default `true`                                              |
| `source`            | String                | default `"assignedByCoach"`                                 |
| `createdAt`         | DateTime              | auto                                                        |
| `updatedAt`         | DateTime              | auto                                                        |

**Operational notes**

- Direct assignment to a single player creates one `JourneyTemplateAssignment` and a generated player plan.
- Direct assignment to a team resolves all active members and creates one separate `JourneyTemplateAssignment` per member.
- Coach-facing journey save and assignment flows rely on the web proxy layer to refresh expired access tokens before retrying the backend request.

---

### `DevelopmentPlanMilestone` (table: `development_plan_milestones`)

A milestone within a `PlayerDevelopmentPlan`, optionally scoped to a `TrainingBlock`.

| Field         | Type                         | Notes                |
| ------------- | ---------------------------- | -------------------- |
| `id`          | String (cuid)                | PK                   |
| `planId`      | FK → PlayerDevelopmentPlan   |                      |
| `blockId`     | FK → TrainingBlock?          | Optional block scope |
| `title`       | String                       |                      |
| `description` | String?                      |                      |
| `dueDate`     | DateTime                     |                      |
| `status`      | `DevelopmentMilestoneStatus` | default `PLANNED`    |
| `createdAt`   | DateTime                     | auto                 |
| `updatedAt`   | DateTime                     | auto                 |

---

### `AvailabilityBlock` (table: `availability_blocks`)

A player's recurring or one-off unavailability period (school, work, holiday, etc.).

| Field               | Type                    | Notes            |
| ------------------- | ----------------------- | ---------------- |
| `id`                | String (cuid)           | PK               |
| `playerId`          | FK → User               |                  |
| `title`             | String                  |                  |
| `type`              | `AvailabilityBlockType` | default `CUSTOM` |
| `startTime`         | DateTime                |                  |
| `endTime`           | DateTime                |                  |
| `recurrence`        | `Recurrence`            | default `NONE`   |
| `recurrenceEndDate` | DateTime?               |                  |
| `notes`             | String?                 |                  |
| `createdAt`         | DateTime                | auto             |
| `updatedAt`         | DateTime                | auto             |

---

### `TeamEvent` (table: `team_events`)

A one-off event (e.g., match, meeting) on a team's calendar, created by the coach.

| Field         | Type          | Notes   |
| ------------- | ------------- | ------- |
| `id`          | String (cuid) | PK      |
| `teamId`      | FK → Team     |         |
| `coachId`     | FK → User     | Creator |
| `title`       | String        |         |
| `description` | String?       |         |
| `location`    | String?       |         |
| `startTime`   | DateTime      |         |
| `endTime`     | DateTime      |         |
| `createdAt`   | DateTime      | auto    |
| `updatedAt`   | DateTime      | auto    |

---

### `Tournament` (table: `tournaments`)

A player's individual tournament entry with priority ranking.

| Field         | Type                 | Notes                |
| ------------- | -------------------- | -------------------- |
| `id`          | String (cuid)        | PK                   |
| `playerId`    | FK → User            |                      |
| `title`       | String               |                      |
| `description` | String?              |                      |
| `location`    | String?              |                      |
| `startTime`   | DateTime             |                      |
| `endTime`     | DateTime             |                      |
| `priority`    | `TournamentPriority` | default `PRIORITY_2` |
| `createdAt`   | DateTime             | auto                 |
| `updatedAt`   | DateTime             | auto                 |

---

### `TaskTemplate` (table: `task_templates`)

Reusable task content templates.

| Field       | Type          |
| ----------- | ------------- |
| `id`        | String (cuid) |
| `title`     | String        |
| `content`   | String        |
| `createdAt` | DateTime      |
| `updatedAt` | DateTime      |

---

### `GolfChallenge` (table: `challenges`)

Simple challenge entity (title only).

| Field       | Type          |
| ----------- | ------------- |
| `id`        | String (cuid) |
| `title`     | String        |
| `createdAt` | DateTime      |
| `updatedAt` | DateTime      |

---

## Entity Relationship Summary

```
User ──< CoachPlayerLink >── User
User ──< UserClub >── Club ──< Team
User (coach) ──< Team ──< TeamMember >── User (player)

User (player) ──< PracticeSlot ──< CalendarTask
Team ──< PracticeSlot ──< CalendarTask

User (coach) ──< TrainingLesson
User (player) ──< TrainingLesson (optional)

User (coach) ──< PlayerDevelopmentPlan >── User (player) | Team
PlayerDevelopmentPlan ──< TrainingBlock ──< LessonAssignment >── TrainingLesson
PlayerDevelopmentPlan ──< DevelopmentPlanMilestone
TrainingBlock ──< DevelopmentPlanMilestone

User (player) ──1──1── PlayerProfile
User (player) ──< AvailabilityBlock
User (player) ──< Tournament

Team ──< TeamEvent (coachId on User)
```

### Key business rules encoded in the schema

1. **Coach–player link required**: `CoachPlayerLink` must exist before a coach can manage a player's data.
2. **OwnerType pattern**: `PracticeSlot` and `PlayerDevelopmentPlan` set either `playerId` or `teamId` depending on `ownerType`; the unused FK is `null`.
3. **Assignment-first + plan-linked model**: `LessonAssignment` can either stand alone as a queue item or belong to a `TrainingBlock`; lessons remain reusable across both flows.
4. **Cascade deletes**: Removing a `User`, `Club`, `Team`, or `Plan` cascades to all child records. `CalendarTask.lessonId` uses `SetNull` on lesson delete.
5. **Gamification**: `PlayerProfile.xp`, `level`, `currentStreak`, `longestStreak`, and `lastActivityAt` are updated by the `GamificationModule` on relevant player actions.
