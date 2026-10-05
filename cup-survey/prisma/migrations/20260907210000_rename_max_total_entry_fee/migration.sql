-- Rename maxTotalSurcharge to maxTotalEntryFee (semantic change: surcharge cap → total entry fee cap)
ALTER TABLE "SurveyResponse" RENAME COLUMN "maxTotalSurcharge" TO "maxTotalEntryFee";
