-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TeamRegistration" ADD COLUMN "clubId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_city_key" ON "Club"("name", "city");

-- CreateIndex
CREATE INDEX "Club_name_idx" ON "Club"("name");

-- CreateIndex
CREATE INDEX "TeamRegistration_clubId_idx" ON "TeamRegistration"("clubId");

-- AddForeignKey
ALTER TABLE "TeamRegistration" ADD CONSTRAINT "TeamRegistration_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill clubs from existing registrations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "Club" ("id", "name", "city", "createdAt")
SELECT gen_random_uuid()::text, "clubName", "city", MIN("createdAt")
FROM "TeamRegistration"
GROUP BY "clubName", "city"
ON CONFLICT ("name", "city") DO NOTHING;

UPDATE "TeamRegistration" tr
SET "clubId" = c."id"
FROM "Club" c
WHERE tr."clubName" = c."name" AND tr."city" = c."city";
