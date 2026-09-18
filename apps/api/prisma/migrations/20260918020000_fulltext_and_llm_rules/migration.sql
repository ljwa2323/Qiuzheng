-- AlterTable
ALTER TABLE "Project" ADD COLUMN "llmGlobalRules" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Citation" ADD COLUMN "fullTextMarkdown" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Citation" ADD COLUMN "pdfFileId" TEXT;
ALTER TABLE "Citation" ADD COLUMN "mdFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Citation_pdfFileId_key" ON "Citation"("pdfFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Citation_mdFileId_key" ON "Citation"("mdFileId");

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_mdFileId_fkey" FOREIGN KEY ("mdFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
