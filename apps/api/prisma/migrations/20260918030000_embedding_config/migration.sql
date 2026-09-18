-- AlterTable
ALTER TABLE "Project" ADD COLUMN "embeddingCredentialId" TEXT;
ALTER TABLE "Project" ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_embeddingCredentialId_fkey" FOREIGN KEY ("embeddingCredentialId") REFERENCES "ModelCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
