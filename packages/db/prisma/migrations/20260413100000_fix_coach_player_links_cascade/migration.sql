-- Fix missing ON DELETE CASCADE for playerId in coach_player_links
-- This ensures that when a player (user) is deleted, all related
-- CoachPlayerLink records are automatically removed.

-- Remove any orphaned coach_player_links rows whose playerId no longer exists
-- in the users table (playerId had no FK when the table was first created,
-- so user deletions could leave dangling references that prevent adding a FK).
DELETE FROM "coach_player_links"
WHERE "playerId" NOT IN (SELECT "id" FROM "users");

-- Drop the existing FK if it exists (it may have been added without CASCADE)
ALTER TABLE "coach_player_links" DROP CONSTRAINT IF EXISTS "coach_player_links_playerId_fkey";

-- Re-add with ON DELETE CASCADE
ALTER TABLE "coach_player_links"
  ADD CONSTRAINT "coach_player_links_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
