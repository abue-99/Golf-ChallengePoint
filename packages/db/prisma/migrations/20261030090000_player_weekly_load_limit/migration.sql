-- Weekly training load limit of a player in minutes (NULL = app default).
ALTER TABLE "users" ADD COLUMN "weeklyLoadLimit" INTEGER;
