-- Coach notes can be shared with the other coaches of a player.
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'SHARED');

ALTER TABLE "coach_player_notes"
ADD COLUMN "visibility" "NoteVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX "coach_player_notes_playerId_visibility_createdAt_idx"
ON "coach_player_notes"("playerId", "visibility", "createdAt");

-- Calendar subscription (ICS feed): one secret token per user.
CREATE TABLE "calendar_feed_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_feed_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_feed_tokens_userId_key" ON "calendar_feed_tokens"("userId");
CREATE UNIQUE INDEX "calendar_feed_tokens_token_key" ON "calendar_feed_tokens"("token");

ALTER TABLE "calendar_feed_tokens"
ADD CONSTRAINT "calendar_feed_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Attendance: a player's answer for one occurrence of a team training or team event.
CREATE TYPE "AttendanceStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "practiceSlotId" TEXT,
    "teamEventId" TEXT,
    "occurrenceKey" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendances_playerId_occurrenceKey_key" ON "attendances"("playerId", "occurrenceKey");
CREATE INDEX "attendances_occurrenceKey_idx" ON "attendances"("occurrenceKey");
CREATE INDEX "attendances_practiceSlotId_occurrenceStart_idx" ON "attendances"("practiceSlotId", "occurrenceStart");

ALTER TABLE "attendances"
ADD CONSTRAINT "attendances_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances"
ADD CONSTRAINT "attendances_practiceSlotId_fkey"
FOREIGN KEY ("practiceSlotId") REFERENCES "practice_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances"
ADD CONSTRAINT "attendances_teamEventId_fkey"
FOREIGN KEY ("teamEventId") REFERENCES "team_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
