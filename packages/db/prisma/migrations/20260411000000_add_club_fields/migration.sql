-- AlterTable "clubs": add shortId, city, country fields
ALTER TABLE "clubs" ADD COLUMN "shortId" TEXT;
ALTER TABLE "clubs" ADD COLUMN "city" TEXT;
ALTER TABLE "clubs" ADD COLUMN "country" TEXT;

CREATE UNIQUE INDEX "clubs_shortId_key" ON "clubs"("shortId");
