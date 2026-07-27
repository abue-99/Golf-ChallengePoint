-- AlterTable: add sub capability fields to training lessons
ALTER TABLE "training_lessons"
  ADD COLUMN "subCapability" TEXT,
  ADD COLUMN "subSubCapability" TEXT;
