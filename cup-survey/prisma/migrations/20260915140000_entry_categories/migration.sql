-- AlterTable
ALTER TABLE "AthleteEntry" ADD COLUMN "ageDivisionId" TEXT;
ALTER TABLE "AthleteEntry" ADD COLUMN "weightCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Athlete" ALTER COLUMN "weight" DROP NOT NULL;
