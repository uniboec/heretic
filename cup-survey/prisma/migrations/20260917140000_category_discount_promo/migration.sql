-- AlterTable
ALTER TABLE "CategoryDiscountRule"
ADD COLUMN "description" TEXT,
ADD COLUMN "showOnSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "startsAt" TIMESTAMP(3),
ADD COLUMN "endsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CategoryDiscountRule_showOnSite_idx" ON "CategoryDiscountRule"("showOnSite");
