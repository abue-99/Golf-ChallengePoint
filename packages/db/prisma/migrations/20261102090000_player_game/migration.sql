-- Player game: XP ledger / activity feed, coach review, mission results,
-- team challenges, kudos and web push.

ALTER TABLE "users"
ADD COLUMN "weeklyGoalDays" INTEGER,
ADD COLUMN "feedSeenAt" TIMESTAMP(3),
ADD COLUMN "notificationPrefs" JSONB;

ALTER TABLE "teams"
ADD COLUMN "gameEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "training_lessons"
ADD COLUMN "targetScore" INTEGER,
ADD COLUMN "targetAttempts" INTEGER;

ALTER TABLE "lesson_assignments"
ADD COLUMN "coachRating" INTEGER,
ADD COLUMN "coachComment" TEXT,
ADD COLUMN "coachPick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "playerSeenReviewAt" TIMESTAMP(3),
ADD COLUMN "resultScore" INTEGER,
ADD COLUMN "stars" INTEGER,
ADD COLUMN "practiceMinutes" INTEGER,
ADD COLUMN "exercisesDone" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "lesson_assignments"
ADD CONSTRAINT "lesson_assignments_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "refId" TEXT,
    "title" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_events_playerId_type_refKey_key"
ON "activity_events"("playerId", "type", "refKey");
CREATE INDEX "activity_events_playerId_createdAt_idx"
ON "activity_events"("playerId", "createdAt");
CREATE INDEX "activity_events_createdAt_idx" ON "activity_events"("createdAt");

ALTER TABLE "activity_events"
ADD CONSTRAINT "activity_events_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events"
ADD CONSTRAINT "activity_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "kudos" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kudos_eventId_fromId_key" ON "kudos"("eventId", "fromId");

ALTER TABLE "kudos"
ADD CONSTRAINT "kudos_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kudos"
ADD CONSTRAINT "kudos_fromId_fkey"
FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "team_challenges" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "focusArea" "LessonFocusArea",
    "unit" TEXT NOT NULL DEFAULT 'points',
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "targetScore" INTEGER,
    "isBenchmark" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_challenges_teamId_endsAt_idx" ON "team_challenges"("teamId", "endsAt");

ALTER TABLE "team_challenges"
ADD CONSTRAINT "team_challenges_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_challenges"
ADD CONSTRAINT "team_challenges_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "challenge_entries" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "challenge_entries_challengeId_playerId_idx"
ON "challenge_entries"("challengeId", "playerId");

ALTER TABLE "challenge_entries"
ADD CONSTRAINT "challenge_entries_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "team_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_entries"
ADD CONSTRAINT "challenge_entries_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

ALTER TABLE "push_subscriptions"
ADD CONSTRAINT "push_subscriptions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
