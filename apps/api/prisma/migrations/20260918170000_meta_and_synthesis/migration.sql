-- CreateTable
CREATE TABLE "OutcomeAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measure" TEXT NOT NULL DEFAULT 'OR',
    "modelPref" TEXT NOT NULL DEFAULT 'random',
    "notes" TEXT NOT NULL DEFAULT '',
    "mappingJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutcomeAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EffectRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outcomeAnalysisId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "eventsT" DOUBLE PRECISION,
    "nT" DOUBLE PRECISION,
    "eventsC" DOUBLE PRECISION,
    "nC" DOUBLE PRECISION,
    "meanT" DOUBLE PRECISION,
    "sdT" DOUBLE PRECISION,
    "meanC" DOUBLE PRECISION,
    "sdC" DOUBLE PRECISION,
    "yi" DOUBLE PRECISION,
    "sei" DOUBLE PRECISION,
    "ciLow" DOUBLE PRECISION,
    "ciHigh" DOUBLE PRECISION,
    "subgroup" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EffectRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outcomeAnalysisId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "recipe" TEXT NOT NULL DEFAULT 'fixed_random',
    "model" TEXT NOT NULL DEFAULT 'random',
    "measure" TEXT NOT NULL DEFAULT 'OR',
    "resultJson" JSONB NOT NULL,
    "forestSvg" TEXT NOT NULL DEFAULT '',
    "workspacePath" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetaRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SynthesisCompose" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queries" TEXT[],
    "knowledgeJson" JSONB NOT NULL,
    "markdown" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT 'Evidence synthesis',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SynthesisCompose_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeAnalysis_projectId_idx" ON "OutcomeAnalysis"("projectId");
CREATE INDEX "EffectRow_projectId_outcomeAnalysisId_idx" ON "EffectRow"("projectId", "outcomeAnalysisId");
CREATE UNIQUE INDEX "EffectRow_outcomeAnalysisId_citationId_key" ON "EffectRow"("outcomeAnalysisId", "citationId");
CREATE INDEX "MetaRun_projectId_createdAt_idx" ON "MetaRun"("projectId", "createdAt");
CREATE INDEX "MetaRun_outcomeAnalysisId_createdAt_idx" ON "MetaRun"("outcomeAnalysisId", "createdAt");
CREATE INDEX "SynthesisCompose_projectId_createdAt_idx" ON "SynthesisCompose"("projectId", "createdAt");

ALTER TABLE "OutcomeAnalysis" ADD CONSTRAINT "OutcomeAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EffectRow" ADD CONSTRAINT "EffectRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EffectRow" ADD CONSTRAINT "EffectRow_outcomeAnalysisId_fkey" FOREIGN KEY ("outcomeAnalysisId") REFERENCES "OutcomeAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EffectRow" ADD CONSTRAINT "EffectRow_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaRun" ADD CONSTRAINT "MetaRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaRun" ADD CONSTRAINT "MetaRun_outcomeAnalysisId_fkey" FOREIGN KEY ("outcomeAnalysisId") REFERENCES "OutcomeAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SynthesisCompose" ADD CONSTRAINT "SynthesisCompose_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
