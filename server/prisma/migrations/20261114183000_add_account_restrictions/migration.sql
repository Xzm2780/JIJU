-- AlterTable
ALTER TABLE "User"
ADD COLUMN "postingRestrictedUntil" TIMESTAMP(3),
ADD COLUMN "commentingRestrictedUntil" TIMESTAMP(3),
ADD COLUMN "reactionRestrictedUntil" TIMESTAMP(3);
