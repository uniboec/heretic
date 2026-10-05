-- CreateTable
CREATE TABLE "RankQualificationSetting" (
    "tournamentScopeId" TEXT NOT NULL,
    "evskEventLevel" TEXT NOT NULL DEFAULT 'regional_cup',
    "latestCalcId" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankQualificationSetting_pkey" PRIMARY KEY ("tournamentScopeId")
);

-- CreateTable
CREATE TABLE "RankQualificationCalc" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredBy" TEXT NOT NULL,
    "evskRuleSetVersion" TEXT NOT NULL,
    "evskRuleSetHash" TEXT NOT NULL,
    "winCountingRuleVersion" TEXT NOT NULL,
    "qualificationDate" TEXT NOT NULL,
    "calculationEngineVersion" TEXT NOT NULL,
    "evskSourceUrl" TEXT NOT NULL DEFAULT 'https://m-m-a.ru/evsk/',

    CONSTRAINT "RankQualificationCalc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankQualificationResult" (
    "id" TEXT NOT NULL,
    "calcId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "achievedNormRank" TEXT,
    "sourceBracketDetailId" TEXT,
    "displayPlacement" INTEGER,
    "displayWins" INTEGER,
    "evskRuleSnapshot" JSONB,

    CONSTRAINT "RankQualificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankQualificationBracketDetail" (
    "id" TEXT NOT NULL,
    "calcId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "actualBracketId" TEXT,
    "placement" INTEGER,
    "wins" INTEGER NOT NULL,
    "achievedRank" TEXT,
    "isAgeUp" BOOLEAN NOT NULL DEFAULT false,
    "evskRuleSnapshot" JSONB,

    CONSTRAINT "RankQualificationBracketDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankQualificationSetting_latestCalcId_key" ON "RankQualificationSetting"("latestCalcId");

-- CreateIndex
CREATE INDEX "RankQualificationCalc_tournamentScopeId_idx" ON "RankQualificationCalc"("tournamentScopeId");

-- CreateIndex
CREATE UNIQUE INDEX "RankQualificationCalc_tournamentScopeId_version_key" ON "RankQualificationCalc"("tournamentScopeId", "version");

-- CreateIndex
CREATE INDEX "RankQualificationResult_calcId_idx" ON "RankQualificationResult"("calcId");

-- CreateIndex
CREATE UNIQUE INDEX "RankQualificationResult_calcId_athleteId_discipline_key" ON "RankQualificationResult"("calcId", "athleteId", "discipline");

-- CreateIndex
CREATE INDEX "RankQualificationBracketDetail_calcId_idx" ON "RankQualificationBracketDetail"("calcId");

-- CreateIndex
CREATE UNIQUE INDEX "RankQualificationBracketDetail_calcId_athleteId_discipline_ca_key" ON "RankQualificationBracketDetail"("calcId", "athleteId", "discipline", "categoryKey");

-- AddForeignKey
ALTER TABLE "RankQualificationSetting" ADD CONSTRAINT "RankQualificationSetting_latestCalcId_fkey" FOREIGN KEY ("latestCalcId") REFERENCES "RankQualificationCalc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankQualificationResult" ADD CONSTRAINT "RankQualificationResult_calcId_fkey" FOREIGN KEY ("calcId") REFERENCES "RankQualificationCalc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankQualificationResult" ADD CONSTRAINT "RankQualificationResult_sourceBracketDetailId_fkey" FOREIGN KEY ("sourceBracketDetailId") REFERENCES "RankQualificationBracketDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankQualificationBracketDetail" ADD CONSTRAINT "RankQualificationBracketDetail_calcId_fkey" FOREIGN KEY ("calcId") REFERENCES "RankQualificationCalc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RankQualificationSetting" (
    "tournamentScopeId",
    "evskEventLevel",
    "publicEnabled",
    "updatedAt"
)
VALUES ('cup-2026', 'regional_cup', true, CURRENT_TIMESTAMP)
ON CONFLICT ("tournamentScopeId") DO NOTHING;
