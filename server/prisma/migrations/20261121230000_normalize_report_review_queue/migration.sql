DO $$
DECLARE index_row RECORD;
BEGIN
  FOR index_row IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename IN ('Report', 'ModerationRecord')
      AND indexname NOT LIKE '%_pkey'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', index_row.indexname);
  END LOOP;
END $$;

UPDATE "Report"
SET "reason" = 'OTHER'
WHERE "reason"::text NOT IN (
  'ABUSE',
  'PRIVACY',
  'DANGEROUS_OR_INAPPROPRIATE',
  'SPAM',
  'OTHER'
);

DO $$
DECLARE column_row RECORD;
BEGIN
  FOR column_row IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Report'
      AND column_name NOT IN (
        'id',
        'reporterId',
        'targetType',
        'targetId',
        'contentVersion',
        'reason',
        'otherDescription',
        'status',
        'dedupeKey',
        'submittedAt',
        'updatedAt',
        'handledBy',
        'handledAt'
      )
  LOOP
    EXECUTE format('ALTER TABLE "Report" DROP COLUMN IF EXISTS %I', column_row.column_name);
  END LOOP;

  FOR column_row IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ModerationRecord'
      AND column_name NOT IN (
        'id',
        'targetType',
        'targetId',
        'contentVersion',
        'reviewRound',
        'status',
        'hitRuleRefs',
        'moderationStatusAfter',
        'publicStatusAfter',
        'handledBy',
        'handledAt',
        'reason',
        'createdAt'
      )
  LOOP
    EXECUTE format('ALTER TABLE "ModerationRecord" DROP COLUMN IF EXISTS %I', column_row.column_name);
  END LOOP;
END $$;

ALTER TYPE "ReportReason" RENAME TO "ReportReason_previous";
CREATE TYPE "ReportReason" AS ENUM (
  'ABUSE',
  'PRIVACY',
  'DANGEROUS_OR_INAPPROPRIATE',
  'SPAM',
  'OTHER'
);
ALTER TABLE "Report"
  ALTER COLUMN "reason" TYPE "ReportReason"
  USING ("reason"::text::"ReportReason");
DROP TYPE "ReportReason_previous";
DROP TYPE IF EXISTS "ModerationPriority";

CREATE UNIQUE INDEX "Report_dedupeKey_key" ON "Report"("dedupeKey");
CREATE INDEX "Report_status_submittedAt_id_idx"
  ON "Report"("status", "submittedAt", "id");
CREATE INDEX "Report_reporterId_submittedAt_idx"
  ON "Report"("reporterId", "submittedAt");
CREATE INDEX "Report_targetType_targetId_contentVersion_idx"
  ON "Report"("targetType", "targetId", "contentVersion");
CREATE UNIQUE INDEX "ModerationRecord_targetType_targetId_contentVersion_reviewRound_key"
  ON "ModerationRecord"("targetType", "targetId", "contentVersion", "reviewRound");
CREATE INDEX "ModerationRecord_status_createdAt_id_idx"
  ON "ModerationRecord"("status", "createdAt", "id");
CREATE INDEX "ModerationRecord_targetType_targetId_contentVersion_idx"
  ON "ModerationRecord"("targetType", "targetId", "contentVersion");
