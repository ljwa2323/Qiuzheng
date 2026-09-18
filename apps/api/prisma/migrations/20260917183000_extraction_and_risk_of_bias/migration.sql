-- CreateTable
CREATE TABLE "ExtractionField" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdBy" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'characteristics',
    "dataType" TEXT NOT NULL DEFAULT 'text',
    "description" TEXT NOT NULL DEFAULT '',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtractionField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionValue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "evidenceText" TEXT,
    "sourceLocation" TEXT,
    "confidence" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtractionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskOfBiasJudgement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "domainKey" TEXT NOT NULL,
    "domainTitle" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "actor" "DecisionActor" NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "judgement" TEXT NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "sourceLocation" TEXT,
    "rationale" TEXT,
    "confidence" TEXT,
    "userId" TEXT,
    "modelRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiskOfBiasJudgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtractionField_projectId_key_key" ON "ExtractionField"("projectId", "key");
CREATE INDEX "ExtractionField_projectId_group_sortOrder_idx" ON "ExtractionField"("projectId", "group", "sortOrder");
CREATE UNIQUE INDEX "ExtractionValue_citationId_fieldId_key" ON "ExtractionValue"("citationId", "fieldId");
CREATE INDEX "ExtractionValue_projectId_citationId_idx" ON "ExtractionValue"("projectId", "citationId");
CREATE UNIQUE INDEX "RiskOfBiasJudgement_citationId_domainKey_questionKey_actor_reviewerKey_key" ON "RiskOfBiasJudgement"("citationId", "domainKey", "questionKey", "actor", "reviewerKey");
CREATE INDEX "RiskOfBiasJudgement_projectId_citationId_idx" ON "RiskOfBiasJudgement"("projectId", "citationId");
CREATE INDEX "RiskOfBiasJudgement_citationId_domainKey_idx" ON "RiskOfBiasJudgement"("citationId", "domainKey");

ALTER TABLE "ExtractionField" ADD CONSTRAINT "ExtractionField_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionField" ADD CONSTRAINT "ExtractionField_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExtractionValue" ADD CONSTRAINT "ExtractionValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionValue" ADD CONSTRAINT "ExtractionValue_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionValue" ADD CONSTRAINT "ExtractionValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ExtractionField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractionValue" ADD CONSTRAINT "ExtractionValue_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskOfBiasJudgement" ADD CONSTRAINT "RiskOfBiasJudgement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskOfBiasJudgement" ADD CONSTRAINT "RiskOfBiasJudgement_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskOfBiasJudgement" ADD CONSTRAINT "RiskOfBiasJudgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskOfBiasJudgement" ADD CONSTRAINT "RiskOfBiasJudgement_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
