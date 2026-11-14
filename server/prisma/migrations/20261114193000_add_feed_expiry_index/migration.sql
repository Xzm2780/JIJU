-- CreateIndex
CREATE INDEX "Post_publicStatus_expiresAt_publishedAt_id_idx" ON "Post"("publicStatus", "expiresAt", "publishedAt", "id");
