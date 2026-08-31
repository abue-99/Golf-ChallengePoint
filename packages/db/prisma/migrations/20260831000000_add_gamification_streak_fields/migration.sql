-- AlterTable: Add gamification fields (xp, level, streak) to player_profiles
ALTER TABLE "player_profiles" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_profiles" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "player_profiles" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_profiles" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_profiles" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
