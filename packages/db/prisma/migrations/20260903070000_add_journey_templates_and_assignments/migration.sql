-- CreateEnum
CREATE TYPE "JourneyDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "journey_templates" (
  "id" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "difficulty" "JourneyDifficulty",
  "coverImageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_template_lessons" (
  "id" TEXT NOT NULL,
  "journeyTemplateId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_template_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_template_assignments" (
  "id" TEXT NOT NULL,
  "journeyTemplateId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "teamId" TEXT,
  "coachId" TEXT NOT NULL,
  "playerPlanId" TEXT NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'NEW',
  "isInTrainingQueue" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'assignedByCoach',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journey_template_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journey_templates_coachId_createdAt_idx" ON "journey_templates"("coachId", "createdAt");
CREATE INDEX "journey_template_lessons_journeyTemplateId_sortOrder_idx" ON "journey_template_lessons"("journeyTemplateId", "sortOrder");
CREATE INDEX "journey_template_lessons_lessonId_idx" ON "journey_template_lessons"("lessonId");
CREATE INDEX "journey_template_assignments_playerId_isInTrainingQueue_createdAt_idx" ON "journey_template_assignments"("playerId", "isInTrainingQueue", "createdAt");
CREATE INDEX "journey_template_assignments_coachId_createdAt_idx" ON "journey_template_assignments"("coachId", "createdAt");
CREATE INDEX "journey_template_assignments_teamId_idx" ON "journey_template_assignments"("teamId");

-- AddForeignKey
ALTER TABLE "journey_templates" ADD CONSTRAINT "journey_templates_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_template_lessons" ADD CONSTRAINT "journey_template_lessons_journeyTemplateId_fkey"
  FOREIGN KEY ("journeyTemplateId") REFERENCES "journey_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_template_lessons" ADD CONSTRAINT "journey_template_lessons_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "training_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_template_assignments" ADD CONSTRAINT "journey_template_assignments_journeyTemplateId_fkey"
  FOREIGN KEY ("journeyTemplateId") REFERENCES "journey_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_template_assignments" ADD CONSTRAINT "journey_template_assignments_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_template_assignments" ADD CONSTRAINT "journey_template_assignments_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journey_template_assignments" ADD CONSTRAINT "journey_template_assignments_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
