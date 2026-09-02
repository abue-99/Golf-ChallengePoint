-- CreateEnum
CREATE TYPE "AssignmentSourceType" AS ENUM ('PLAYER', 'TEAM', 'GROUP');

-- AlterTable
ALTER TABLE "lesson_assignments"
  ADD COLUMN "sourceType" "AssignmentSourceType" NOT NULL DEFAULT 'PLAYER',
  ADD COLUMN "sourceReference" TEXT;

-- Backfill existing rows
UPDATE "lesson_assignments"
SET "sourceType" = CASE
  WHEN "targetType" = 'TEAM' THEN 'TEAM'::"AssignmentSourceType"
  WHEN "targetType" = 'GROUP' THEN 'GROUP'::"AssignmentSourceType"
  ELSE 'PLAYER'::"AssignmentSourceType"
END,
"sourceReference" = CASE
  WHEN "targetType" = 'TEAM' THEN "teamId"
  WHEN "targetType" = 'PLAYER' THEN "playerId"
  ELSE "groupName"
END;
