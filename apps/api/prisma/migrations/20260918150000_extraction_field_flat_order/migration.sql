-- Flatten legacy group-based ordering into a single sortOrder sequence per project.
WITH ordered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY "group" ASC, "sortOrder" ASC, "createdAt" ASC
    ) - 1) * 10 AS new_order
  FROM "ExtractionField"
)
UPDATE "ExtractionField" AS f
SET "sortOrder" = ordered.new_order
FROM ordered
WHERE f.id = ordered.id;

UPDATE "ExtractionField" SET "group" = 'characteristics' WHERE "group" IS DISTINCT FROM 'characteristics';
