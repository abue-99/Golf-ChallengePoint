-- Fix missing ON DELETE CASCADE for playerId in coach_player_links
-- This ensures that when a player (user) is deleted, all related
-- CoachPlayerLink records are automatically removed.

-- Drop the existing FK if it exists (it may have been added without CASCADE)
ALTER TABLE "coach_player_links" DROP CONSTRAINT IF EXISTS "coach_player_links_playerId_fkey";

-- Re-add with ON DELETE CASCADE
ALTER TABLE "coach_player_links"
  ADD CONSTRAINT "coach_player_links_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
