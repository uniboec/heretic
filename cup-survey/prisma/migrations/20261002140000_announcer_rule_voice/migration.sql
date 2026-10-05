-- AlterTable
ALTER TABLE "AnnouncerRule" ADD COLUMN "ttsProvider" TEXT,
ADD COLUMN "ttsVoiceId" TEXT;

-- AlterTable
ALTER TABLE "AnnouncerEvent" ADD COLUMN "generationTtsSignature" TEXT,
ADD COLUMN "ttsProviderUsed" TEXT,
ADD COLUMN "ttsVoiceIdUsed" TEXT;
