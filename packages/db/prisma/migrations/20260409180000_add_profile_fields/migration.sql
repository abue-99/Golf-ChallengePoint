-- Add profile fields to users table
ALTER TABLE "users"
  ADD COLUMN "gender"      TEXT,
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "timezone"    TEXT;
