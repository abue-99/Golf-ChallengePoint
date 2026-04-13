-- Add icon and clubId to teams, make description optional
ALTER TABLE "teams" ADD COLUMN "icon" TEXT;
ALTER TABLE "teams" ADD COLUMN "clubId" TEXT;
ALTER TABLE "teams" ALTER COLUMN "description" DROP NOT NULL;

-- Add FK constraint for clubId -> clubs
ALTER TABLE "teams" ADD CONSTRAINT "teams_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
