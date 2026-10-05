-- CreateTable
CREATE TABLE "RegistrationScheduleSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "earlyEndsAt" TIMESTAMP(3),
    "regularStartsAt" TIMESTAMP(3),
    "regularEndsAt" TIMESTAMP(3),
    "lateStartsAt" TIMESTAMP(3),
    "lateEndsAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationScheduleSetting_pkey" PRIMARY KEY ("id")
);
