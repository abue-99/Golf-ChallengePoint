-- Automatic reminder before team sessions (hours before start; NULL = off).
ALTER TABLE "teams" ADD COLUMN "autoRemindHours" INTEGER;

-- Reminders sent to players who have not answered yet.
CREATE TYPE "ReminderKind" AS ENUM ('MANUAL', 'AUTO');

CREATE TABLE "attendance_reminders" (
    "id" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sentById" TEXT,
    "kind" "ReminderKind" NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_reminders_occurrenceKey_sentAt_idx" ON "attendance_reminders"("occurrenceKey", "sentAt");
CREATE INDEX "attendance_reminders_teamId_sentAt_idx" ON "attendance_reminders"("teamId", "sentAt");

ALTER TABLE "attendance_reminders"
ADD CONSTRAINT "attendance_reminders_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_reminders"
ADD CONSTRAINT "attendance_reminders_sentById_fkey"
FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
