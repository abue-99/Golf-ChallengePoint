-- Coaching team: roles of coaches for teams and players.
CREATE TYPE "CoachRole" AS ENUM ('HEAD_COACH', 'ASSISTANT', 'FITNESS', 'MENTAL');

-- Role of a coach for a linked player (NULL = not specified).
ALTER TABLE "coach_player_links" ADD COLUMN "role" "CoachRole";

-- Further coaches of a team; the head coach stays in teams.coachId.
CREATE TABLE "team_coaches" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "role" "CoachRole" NOT NULL DEFAULT 'ASSISTANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_coaches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_coaches_teamId_coachId_key" ON "team_coaches"("teamId", "coachId");
CREATE INDEX "team_coaches_coachId_idx" ON "team_coaches"("coachId");

ALTER TABLE "team_coaches"
ADD CONSTRAINT "team_coaches_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_coaches"
ADD CONSTRAINT "team_coaches_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
