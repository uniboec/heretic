-- AlterTable
ALTER TABLE "BoutsPageSetting"
ADD COLUMN "boutsStartTime" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN "matStartTimeOverrides" JSONB,
ADD COLUMN "boutBreakMinutes" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "ageDivisionDurationOverrides" JSONB;

-- CreateTable
CREATE TABLE "BoutScheduleExecution" (
    "id" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoutScheduleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatScheduleRuntime" (
    "matIndex" INTEGER NOT NULL,
    "manualNotBeforeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatScheduleRuntime_pkey" PRIMARY KEY ("matIndex")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoutScheduleExecution_boutId_key" ON "BoutScheduleExecution"("boutId");

-- Seed runtime rows for mats 1..3
INSERT INTO "MatScheduleRuntime" ("matIndex", "manualNotBeforeAt", "updatedAt")
VALUES
  (1, NULL, CURRENT_TIMESTAMP),
  (2, NULL, CURRENT_TIMESTAMP),
  (3, NULL, CURRENT_TIMESTAMP);
