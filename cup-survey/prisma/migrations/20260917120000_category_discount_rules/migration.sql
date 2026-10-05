-- CreateTable
CREATE TABLE "CategoryDiscountRule" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "discountPercent" INTEGER NOT NULL,
    "discipline" TEXT,
    "experienceLevel" TEXT,
    "ageDivisionId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryDiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryDiscountRule_enabled_idx" ON "CategoryDiscountRule"("enabled");
