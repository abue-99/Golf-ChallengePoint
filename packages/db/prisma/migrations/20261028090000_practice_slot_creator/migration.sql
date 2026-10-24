-- Who created a training window: coaching staff may change their own,
-- the head coach every window of the team.
ALTER TABLE "practice_slots" ADD COLUMN "createdById" TEXT;

ALTER TABLE "practice_slots"
ADD CONSTRAINT "practice_slots_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing team windows were created by the team's (head) coach.
UPDATE "practice_slots" ps
SET "createdById" = t."coachId"
FROM "teams" t
WHERE ps."teamId" = t."id" AND ps."ownerType" = 'TEAM';

UPDATE "practice_slots"
SET "createdById" = "playerId"
WHERE "ownerType" = 'PLAYER' AND "playerId" IS NOT NULL;
