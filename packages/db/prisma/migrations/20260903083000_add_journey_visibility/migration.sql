-- CreateEnum
CREATE TYPE "JourneyVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "journey_templates"
ADD COLUMN "visibility" "JourneyVisibility" NOT NULL DEFAULT 'PRIVATE';
