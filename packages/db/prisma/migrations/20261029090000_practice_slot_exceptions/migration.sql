-- Single occurrences of a (recurring) team training that were moved or
-- cancelled; the rest of the series stays unchanged.
CREATE TABLE "practice_slot_exceptions" (
    "id" TEXT NOT NULL,
    "practiceSlotId" TEXT NOT NULL,
    "originalStart" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "newStart" TIMESTAMP(3),
    "newEnd" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_slot_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "practice_slot_exceptions_practiceSlotId_originalStart_key" ON "practice_slot_exceptions"("practiceSlotId", "originalStart");

ALTER TABLE "practice_slot_exceptions"
ADD CONSTRAINT "practice_slot_exceptions_practiceSlotId_fkey"
FOREIGN KEY ("practiceSlotId") REFERENCES "practice_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practice_slot_exceptions"
ADD CONSTRAINT "practice_slot_exceptions_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
