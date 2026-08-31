-- CreateEnum
CREATE TYPE "CalendarTaskStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AvailabilityBlockType" AS ENUM ('SCHOOL', 'WORK', 'HOLIDAY', 'TRAVEL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TournamentPriority" AS ENUM ('PRIORITY_1', 'PRIORITY_2', 'PRIORITY_3');

-- CreateEnum
CREATE TYPE "DevelopmentMilestoneStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- AlterTable
ALTER TABLE "calendar_tasks"
  ADD COLUMN "status" "CalendarTaskStatus" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lessonId" TEXT;

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AvailabilityBlockType" NOT NULL DEFAULT 'CUSTOM',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'NONE',
    "recurrenceEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_events" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "priority" "TournamentPriority" NOT NULL DEFAULT 'PRIORITY_2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_plan_milestones" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "blockId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DevelopmentMilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_plan_milestones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "calendar_tasks" ADD CONSTRAINT "calendar_tasks_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "training_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plan_milestones" ADD CONSTRAINT "development_plan_milestones_planId_fkey" FOREIGN KEY ("planId") REFERENCES "player_development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plan_milestones" ADD CONSTRAINT "development_plan_milestones_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "training_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
