-- Reconcile databases that applied the original init migration before the B0 contract changes.
DO $$ BEGIN
  CREATE TYPE "AdminRole" AS ENUM ('REPORT_REVIEWER', 'CONTENT_MODERATOR', 'ACCOUNT_MODERATOR', 'AUDITOR', 'CONFIG_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportTargetType" AS ENUM ('POST', 'COMMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "ReportReason" AS ENUM ('ABUSE', 'PRIVACY', 'DANGEROUS_OR_INAPPROPRIATE', 'SPAM', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ALTER COLUMN "loginCode" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authSubjectRef" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'MOCK';

CREATE UNIQUE INDEX IF NOT EXISTS "User_authSubjectRef_key" ON "User"("authSubjectRef");

CREATE TABLE IF NOT EXISTS "AdminRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "scope" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "AdminRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "otherDescription" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "contentVersion" INTEGER,
    "stateBefore" JSONB,
    "stateAfter" JSONB,
    "reason" TEXT,
    "requestId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminRoleAssignment_userId_active_role_idx" ON "AdminRoleAssignment"("userId", "active", "role");
CREATE INDEX IF NOT EXISTS "AdminRoleAssignment_role_active_idx" ON "AdminRoleAssignment"("role", "active");
CREATE INDEX IF NOT EXISTS "ModerationRecord_status_createdAt_id_idx" ON "ModerationRecord"("status", "createdAt", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "Report_dedupeKey_key" ON "Report"("dedupeKey");
CREATE INDEX IF NOT EXISTS "Report_status_submittedAt_id_idx" ON "Report"("status", "submittedAt", "id");
CREATE INDEX IF NOT EXISTS "Report_reporterId_submittedAt_idx" ON "Report"("reporterId", "submittedAt");
CREATE INDEX IF NOT EXISTS "Report_targetType_targetId_contentVersion_idx" ON "Report"("targetType", "targetId", "contentVersion");
CREATE INDEX IF NOT EXISTS "AuditLog_objectType_objectId_occurredAt_idx" ON "AuditLog"("objectType", "objectId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actionType_occurredAt_idx" ON "AuditLog"("actionType", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "AdminRoleAssignment" ADD CONSTRAINT "AdminRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_handledBy_fkey" FOREIGN KEY ("handledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
