-- CreateEnum
CREATE TYPE "LessonVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('OUTSTANDING', 'STARTED', 'FINISHED', 'REVIEWED');

-- AlterTable: add visibility to training_lessons
ALTER TABLE "training_lessons" ADD COLUMN "visibility" "LessonVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable: player_development_plans
CREATE TABLE "player_development_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coachId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_development_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: training_blocks
CREATE TABLE "training_blocks" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lesson_assignments
CREATE TABLE "lesson_assignments" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" "LessonPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playerNotes" TEXT,
    "selfAssessment" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "player_development_plans" ADD CONSTRAINT "player_development_plans_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_development_plans" ADD CONSTRAINT "player_development_plans_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "player_development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_assignments" ADD CONSTRAINT "lesson_assignments_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "training_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_assignments" ADD CONSTRAINT "lesson_assignments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "training_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_assignments" ADD CONSTRAINT "lesson_assignments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
