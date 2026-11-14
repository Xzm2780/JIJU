-- CreateTable
CREATE TABLE "AdminCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminCredential_userId_key" ON "AdminCredential"("userId");
CREATE UNIQUE INDEX "AdminCredential_username_key" ON "AdminCredential"("username");
CREATE INDEX "AdminCredential_username_active_idx" ON "AdminCredential"("username", "active");

ALTER TABLE "AdminCredential" ADD CONSTRAINT "AdminCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
