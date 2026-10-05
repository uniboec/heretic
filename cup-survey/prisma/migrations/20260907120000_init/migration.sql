-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "representativeName" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rolesOther" TEXT,
    "organizationName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "athletesCount" INTEGER,
    "acceptableVenues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredVenue" TEXT NOT NULL,
    "dayFormatPreference" TEXT NOT NULL,
    "acceptableMedals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptableBelts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptableAwardPackages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxAwardsSurcharge" INTEGER NOT NULL,
    "maxTotalSurcharge" INTEGER NOT NULL,
    "priorities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prioritiesOther" TEXT,
    "comment" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_submissionId_key" ON "SurveyResponse"("submissionId");

-- CreateIndex
CREATE INDEX "SurveyResponse_createdAt_idx" ON "SurveyResponse"("createdAt");

-- CreateIndex
CREATE INDEX "SurveyResponse_organizationName_idx" ON "SurveyResponse"("organizationName");

-- CreateIndex
CREATE INDEX "RateLimitEntry_key_createdAt_idx" ON "RateLimitEntry"("key", "createdAt");
