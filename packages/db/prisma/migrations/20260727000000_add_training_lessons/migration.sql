-- CreateEnum
CREATE TYPE "LessonFocusArea" AS ENUM ('SETUP', 'PUTTING', 'SHORT_GAME', 'LONG_GAME', 'TACTICAL', 'FITNESS', 'MENTAL');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LessonPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "GoalAchieved" AS ENUM ('YES', 'PARTIALLY', 'NO');

-- CreateTable
CREATE TABLE "training_lessons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "focusArea" "LessonFocusArea" NOT NULL,
    "location" TEXT,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "videoUrl" TEXT,
    "coachId" TEXT NOT NULL,
    "playerId" TEXT,
    "teamId" TEXT,
    "trainingObjective" TEXT,
    "currentSituation" TEXT,
    "targetOutcome" TEXT,
    "priority" "LessonPriority",
    "plannedExercises" TEXT,
    "successCriteria" TEXT,
    "goalAchieved" "GoalAchieved",
    "playerSelfAssessment" INTEGER,
    "coachRating" INTEGER,
    "afterSessionVideoUrl" TEXT,
    "performanceScore" INTEGER,
    "comments" TEXT,
    "keyLearnings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_lessons_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
