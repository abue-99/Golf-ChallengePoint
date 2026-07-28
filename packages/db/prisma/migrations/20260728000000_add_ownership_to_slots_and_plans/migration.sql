-- Create OwnerType enum
CREATE TYPE "OwnerType" AS ENUM ('PLAYER', 'TEAM');

-- ─── practice_slots: add ownerType and teamId, make playerId nullable ─────────

-- 1. Add ownerType column with default PLAYER (applies to all existing rows)
ALTER TABLE "practice_slots"
  ADD COLUMN "ownerType" "OwnerType" NOT NULL DEFAULT 'PLAYER';

-- 2. Add nullable teamId column
ALTER TABLE "practice_slots"
  ADD COLUMN "teamId" TEXT;

-- 3. Make playerId nullable (team slots have no individual player owner)
ALTER TABLE "practice_slots"
  ALTER COLUMN "playerId" DROP NOT NULL;

-- 4. Add foreign key for teamId → teams
ALTER TABLE "practice_slots"
  ADD CONSTRAINT "practice_slots_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── player_development_plans: add ownerType and teamId, make playerId nullable ─

-- 1. Add ownerType column with default PLAYER (applies to all existing rows)
ALTER TABLE "player_development_plans"
  ADD COLUMN "ownerType" "OwnerType" NOT NULL DEFAULT 'PLAYER';

-- 2. Add nullable teamId column
ALTER TABLE "player_development_plans"
  ADD COLUMN "teamId" TEXT;

-- 3. Make playerId nullable (team plans have no individual player owner)
ALTER TABLE "player_development_plans"
  ALTER COLUMN "playerId" DROP NOT NULL;

-- 4. Add foreign key for teamId → teams
ALTER TABLE "player_development_plans"
  ADD CONSTRAINT "player_development_plans_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
