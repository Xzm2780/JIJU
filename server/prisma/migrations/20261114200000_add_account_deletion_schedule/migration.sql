-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountDeletionScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_accountDeletionScheduledAt_idx" ON "User"("accountDeletionScheduledAt");
