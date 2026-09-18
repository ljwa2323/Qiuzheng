-- AlterTable
ALTER TABLE "RiskOfBiasJudgement" ADD COLUMN IF NOT EXISTS "evidenceSpans" JSONB NOT NULL DEFAULT '[]';

-- Backfill: wrap legacy evidenceText into a single span when spans are empty
UPDATE "RiskOfBiasJudgement"
SET "evidenceSpans" = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy',
    'text', "evidenceText",
    'addedBy', 'human',
    'createdAt', to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
)
WHERE ("evidenceSpans" = '[]'::jsonb OR "evidenceSpans" IS NULL)
  AND length(trim("evidenceText")) > 0;
