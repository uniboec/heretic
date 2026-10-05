-- AlterTable
ALTER TABLE "BoutsPageSetting" ADD COLUMN "matsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BoutsPageSetting" ADD COLUMN "scheduleVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BoutsPageSetting" ADD COLUMN "scheduleLegacyGap" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BoutScheduleExecution" ADD COLUMN "frozenScheduleFormatted" TEXT;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN "frozenScheduleMatNumber" INTEGER;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN "frozenSchedulePosition" INTEGER;

-- CreateTable
CREATE TABLE "ScheduleMutationLog" (
    "mutationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "actorId" TEXT,
    "ownerToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "committedScheduleVersion" INTEGER,
    "responseJson" JSONB,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleMutationLog_pkey" PRIMARY KEY ("mutationId")
);

-- CreateIndex
CREATE INDEX "ScheduleMutationLog_status_leaseUntil_idx" ON "ScheduleMutationLog"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "ScheduleMutationLog_boutId_command_idx" ON "ScheduleMutationLog"("boutId", "command");
