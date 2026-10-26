-- Collaboration: @mentions and handover notes, links in messages, team chat.

ALTER TABLE "coach_player_notes"
ADD COLUMN "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isHandover" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "messages"
ADD COLUMN "refType" TEXT,
ADD COLUMN "refId" TEXT,
ADD COLUMN "refTitle" TEXT;

CREATE TABLE "team_messages" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "refTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_messages_teamId_createdAt_idx" ON "team_messages"("teamId", "createdAt");

ALTER TABLE "team_messages"
ADD CONSTRAINT "team_messages_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_messages"
ADD CONSTRAINT "team_messages_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "team_chat_reads" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_chat_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_chat_reads_teamId_userId_key" ON "team_chat_reads"("teamId", "userId");

ALTER TABLE "team_chat_reads"
ADD CONSTRAINT "team_chat_reads_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_chat_reads"
ADD CONSTRAINT "team_chat_reads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
