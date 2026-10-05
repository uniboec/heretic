-- AlterTable
ALTER TABLE "AthleteMandateCheck" DROP COLUMN "identityStatus",
DROP COLUMN "identityDocumentType";

-- DropEnum
DROP TYPE "IdentityDocumentType";
