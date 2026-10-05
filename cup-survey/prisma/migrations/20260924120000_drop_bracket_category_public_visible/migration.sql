-- P-5: visibility is owned by BracketPublicationState only.
ALTER TABLE "BracketCategoryDraw" DROP COLUMN IF EXISTS "publicVisible";
