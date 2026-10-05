-- CreateTable
CREATE TABLE "RegistrationStage" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bannerTitle" TEXT NOT NULL,
    "pricePerDiscipline" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationStage_sortOrder_idx" ON "RegistrationStage"("sortOrder");

-- Seed default stages, applying legacy overrides when present
INSERT INTO "RegistrationStage" (
    "id",
    "label",
    "bannerTitle",
    "pricePerDiscipline",
    "startsAt",
    "endsAt",
    "sortOrder",
    "updatedAt"
)
SELECT
    'early',
    'Ранняя регистрация',
    'Ранняя регистрация',
    1500,
    NULL,
    COALESCE((SELECT "earlyEndsAt" FROM "RegistrationScheduleSetting" WHERE "id" = 'default'), TIMESTAMP '2026-09-21 18:59:59'),
    0,
    CURRENT_TIMESTAMP
UNION ALL
SELECT
    'regular',
    'Основная регистрация',
    'Основная регистрация',
    1800,
    COALESCE((SELECT "regularStartsAt" FROM "RegistrationScheduleSetting" WHERE "id" = 'default'), TIMESTAMP '2026-09-21 19:00:00'),
    COALESCE((SELECT "regularEndsAt" FROM "RegistrationScheduleSetting" WHERE "id" = 'default'), TIMESTAMP '2026-09-24 18:59:59'),
    1,
    CURRENT_TIMESTAMP
UNION ALL
SELECT
    'late',
    'Поздняя регистрация',
    'Поздняя регистрация',
    2000,
    COALESCE((SELECT "lateStartsAt" FROM "RegistrationScheduleSetting" WHERE "id" = 'default'), TIMESTAMP '2026-09-24 19:00:00'),
    COALESCE((SELECT "lateEndsAt" FROM "RegistrationScheduleSetting" WHERE "id" = 'default'), TIMESTAMP '2026-09-25 12:00:00'),
    2,
    CURRENT_TIMESTAMP;

ALTER TABLE "RegistrationScheduleSetting" DROP COLUMN IF EXISTS "earlyEndsAt";
ALTER TABLE "RegistrationScheduleSetting" DROP COLUMN IF EXISTS "regularStartsAt";
ALTER TABLE "RegistrationScheduleSetting" DROP COLUMN IF EXISTS "regularEndsAt";
ALTER TABLE "RegistrationScheduleSetting" DROP COLUMN IF EXISTS "lateStartsAt";
ALTER TABLE "RegistrationScheduleSetting" DROP COLUMN IF EXISTS "lateEndsAt";
