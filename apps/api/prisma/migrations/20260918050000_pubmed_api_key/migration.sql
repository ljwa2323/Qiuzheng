-- AlterTable
ALTER TABLE "Project" ADD COLUMN "pubmedApiKeyCipher" TEXT;
ALTER TABLE "Project" ADD COLUMN "pubmedApiKeyIv" TEXT;
ALTER TABLE "Project" ADD COLUMN "pubmedApiKeyTag" TEXT;
ALTER TABLE "Project" ADD COLUMN "pubmedApiKeyLast4" TEXT NOT NULL DEFAULT '';
