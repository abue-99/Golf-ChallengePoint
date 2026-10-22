-- Coach feedback inbox: completed lessons the coach has not looked at yet.
ALTER TABLE "lesson_assignments"
ADD COLUMN "coachReviewedAt" TIMESTAMP(3);

-- Existing completions count as seen, so the inbox starts empty.
UPDATE "lesson_assignments"
SET "coachReviewedAt" = COALESCE("completedAt", "updatedAt")
WHERE "status" IN ('COMPLETED', 'ARCHIVED');

CREATE INDEX "lesson_assignments_coachId_coachReviewedAt_idx"
ON "lesson_assignments"("coachId", "coachReviewedAt");

-- Private coach notes about a player.
CREATE TABLE "coach_player_notes" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_player_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_player_notes_coachId_playerId_createdAt_idx"
ON "coach_player_notes"("coachId", "playerId", "createdAt");

ALTER TABLE "coach_player_notes"
ADD CONSTRAINT "coach_player_notes_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_player_notes"
ADD CONSTRAINT "coach_player_notes_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
