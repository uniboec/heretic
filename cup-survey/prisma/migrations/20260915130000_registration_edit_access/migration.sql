-- AlterTable
ALTER TABLE "TeamRegistration" ADD COLUMN "editCodeHash" TEXT;

-- CreateTable
CREATE TABLE "RegistrationDeviceAccess" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationDeviceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationDeviceAccess_registrationId_deviceTokenHash_key" ON "RegistrationDeviceAccess"("registrationId", "deviceTokenHash");

-- CreateIndex
CREATE INDEX "RegistrationDeviceAccess_deviceTokenHash_idx" ON "RegistrationDeviceAccess"("deviceTokenHash");

-- AddForeignKey
ALTER TABLE "RegistrationDeviceAccess" ADD CONSTRAINT "RegistrationDeviceAccess_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TeamRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
