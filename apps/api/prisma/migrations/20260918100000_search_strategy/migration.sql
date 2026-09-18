-- CreateTable
CREATE TABLE "SearchStrategy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "concepts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchStrategy_projectId_key" ON "SearchStrategy"("projectId");

-- AddForeignKey
ALTER TABLE "SearchStrategy" ADD CONSTRAINT "SearchStrategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
