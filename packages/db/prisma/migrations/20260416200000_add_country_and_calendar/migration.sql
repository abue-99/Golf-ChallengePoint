-- Add country field to users
ALTER TABLE "users" ADD COLUMN "country" TEXT;

-- Create Recurrence enum
CREATE TYPE "Recurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable practice_slots
CREATE TABLE "practice_slots" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'NONE',
    "recurrenceEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable calendar_tasks
CREATE TABLE "calendar_tasks" (
    "id" TEXT NOT NULL,
    "practiceSlotId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_tasks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "practice_slots" ADD CONSTRAINT "practice_slots_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_tasks" ADD CONSTRAINT "calendar_tasks_practiceSlotId_fkey"
    FOREIGN KEY ("practiceSlotId") REFERENCES "practice_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_tasks" ADD CONSTRAINT "calendar_tasks_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
