-- CreateEnum
CREATE TYPE "AssignmentTargetType" AS ENUM ('PLAYER', 'TEAM', 'GROUP');

-- Update enum AssignmentStatus to unified workflow
ALTER TYPE "AssignmentStatus" RENAME TO "AssignmentStatus_old";
CREATE TYPE "AssignmentStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

ALTER TABLE "lesson_assignments"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AssignmentStatus" USING (
    CASE
      WHEN "status"::text = 'OUTSTANDING' THEN 'NEW'
      WHEN "status"::text = 'STARTED' THEN 'IN_PROGRESS'
      WHEN "status"::text = 'FINISHED' THEN 'COMPLETED'
      WHEN "status"::text = 'REVIEWED' THEN 'ARCHIVED'
      ELSE 'NEW'
    END
  )::"AssignmentStatus",
  ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "AssignmentStatus_old";

-- AlterTable
ALTER TABLE "lesson_assignments"
  ALTER COLUMN "blockId" DROP NOT NULL,
  ALTER COLUMN "playerId" DROP NOT NULL,
  ADD COLUMN "targetType" "AssignmentTargetType" NOT NULL DEFAULT 'PLAYER',
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "groupName" TEXT,
  ADD COLUMN "isInTrainingQueue" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "teamEventId" TEXT;

ALTER TABLE "calendar_tasks"
  ADD COLUMN "assignmentId" TEXT;

-- Indexes
CREATE UNIQUE INDEX "calendar_tasks_assignmentId_key" ON "calendar_tasks"("assignmentId");
CREATE INDEX "lesson_assignments_targetType_playerId_idx" ON "lesson_assignments"("targetType", "playerId");
CREATE INDEX "lesson_assignments_targetType_teamId_idx" ON "lesson_assignments"("targetType", "teamId");
CREATE INDEX "lesson_assignments_isInTrainingQueue_idx" ON "lesson_assignments"("isInTrainingQueue");

-- AddForeignKey
ALTER TABLE "lesson_assignments" ADD CONSTRAINT "lesson_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_assignments" ADD CONSTRAINT "lesson_assignments_teamEventId_fkey" FOREIGN KEY ("teamEventId") REFERENCES "team_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_tasks" ADD CONSTRAINT "calendar_tasks_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "lesson_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
