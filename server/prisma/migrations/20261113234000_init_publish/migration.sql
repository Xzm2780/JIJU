-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('EMOTION', 'CONTEXT');

-- CreateEnum
CREATE TYPE "PublicStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PASSED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('POST_DAILY');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "ModerationPriority" AS ENUM ('PREEMPTIVE', 'NORMAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "plazaNickname" TEXT NOT NULL,
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeConfirmation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagCatalog" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "catalogVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyGraphemeLength" INTEGER NOT NULL,
    "emotionTagId" TEXT,
    "emotionTagNameSnapshot" TEXT,
    "contextTagId" TEXT,
    "contextTagNameSnapshot" TEXT,
    "retentionHours" INTEGER NOT NULL,
    "publicStatus" "PublicStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PASSED',
    "riskConfirmedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "currentContentVersion" INTEGER NOT NULL DEFAULT 1,
    "editedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyGraphemeLength" INTEGER NOT NULL,
    "emotionTagId" TEXT,
    "emotionTagNameSnapshot" TEXT,
    "contextTagId" TEXT,
    "contextTagNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quotaType" "QuotaType" NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL,
    "responseStatus" INTEGER,
    "responseJson" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationRecord" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "reviewRound" INTEGER NOT NULL DEFAULT 1,
    "priority" "ModerationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hitRuleRefs" JSONB,
    "moderationStatusAfter" "ModerationStatus",
    "publicStatusAfter" "PublicStatus",
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "NoticeConfirmation_userId_noticeVersion_idx" ON "NoticeConfirmation"("userId", "noticeVersion");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeConfirmation_userId_noticeVersion_key" ON "NoticeConfirmation"("userId", "noticeVersion");

-- CreateIndex
CREATE UNIQUE INDEX "TagCatalog_version_key" ON "TagCatalog"("version");

-- CreateIndex
CREATE INDEX "Tag_category_enabled_sortOrder_idx" ON "Tag"("category", "enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_category_name_key" ON "Tag"("category", "name");

-- CreateIndex
CREATE INDEX "Post_publicStatus_moderationStatus_publishedAt_id_idx" ON "Post"("publicStatus", "moderationStatus", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Post_authorId_publicStatus_publishedAt_id_idx" ON "Post"("authorId", "publicStatus", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Post_expiresAt_publicStatus_idx" ON "Post"("expiresAt", "publicStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PostVersion_postId_versionNumber_key" ON "PostVersion"("postId", "versionNumber");

-- CreateIndex
CREATE INDEX "QuotaUsage_userId_quotaType_consumedAt_idx" ON "QuotaUsage"("userId", "quotaType", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsage_userId_quotaType_requestId_key" ON "QuotaUsage"("userId", "quotaType", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsage_userId_quotaType_sourceId_key" ON "QuotaUsage"("userId", "quotaType", "sourceId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_operation_idempotencyKey_key" ON "IdempotencyRecord"("actorId", "operation", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ModerationRecord_status_priority_createdAt_idx" ON "ModerationRecord"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationRecord_targetType_targetId_contentVersion_idx" ON "ModerationRecord"("targetType", "targetId", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationRecord_targetType_targetId_contentVersion_reviewR_key" ON "ModerationRecord"("targetType", "targetId", "contentVersion", "reviewRound");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeConfirmation" ADD CONSTRAINT "NoticeConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVersion" ADD CONSTRAINT "PostVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationRecord" ADD CONSTRAINT "ModerationRecord_handledBy_fkey" FOREIGN KEY ("handledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
