-- Third visibility between PRIVATE and PUBLIC: coaches of the same club.
ALTER TYPE "LessonVisibility" ADD VALUE IF NOT EXISTS 'CLUB';
ALTER TYPE "JourneyVisibility" ADD VALUE IF NOT EXISTS 'CLUB';

-- Copies from the library remember their origin (no foreign key: the
-- original may be deleted, the copy stays).
ALTER TABLE "training_lessons" ADD COLUMN "copiedFromId" TEXT;
ALTER TABLE "journey_templates" ADD COLUMN "copiedFromId" TEXT;
CREATE INDEX "training_lessons_coachId_copiedFromId_idx" ON "training_lessons"("coachId", "copiedFromId");
CREATE INDEX "journey_templates_coachId_copiedFromId_idx" ON "journey_templates"("coachId", "copiedFromId");
