-- Restore Role enum (was dropped in migration 20260329205705)
CREATE TYPE "Role" AS ENUM ('PLAYER', 'COACH', 'ADMIN');

-- Rename password → passwordHash (preserves NOT NULL constraint and existing data)
ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash";

-- Add missing columns
ALTER TABLE "users"
  ADD COLUMN "firstName"    TEXT,
  ADD COLUMN "lastName"     TEXT,
  ADD COLUMN "profileImage" TEXT,
  ADD COLUMN "lastLogin"    TIMESTAMP(3);

-- Migrate role TEXT → Role enum
-- Normalize any legacy 'user' default (or other non-enum) values to PLAYER first
UPDATE "users" SET "role" = 'PLAYER' WHERE "role" NOT IN ('PLAYER', 'COACH', 'ADMIN');

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role",
  ALTER COLUMN "role" SET DEFAULT 'PLAYER'::"Role";

-- Re-add unique index on player_profiles.userId (was dropped in migration 20260329205705)
CREATE UNIQUE INDEX "player_profiles_userId_key" ON "player_profiles"("userId");

-- Re-add FK: player_profiles.userId → users.id
ALTER TABLE "player_profiles"
  ADD CONSTRAINT "player_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-add FK: coach_player_links.coachId → users.id
ALTER TABLE "coach_player_links"
  ADD CONSTRAINT "coach_player_links_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
