-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "segmentId" TEXT,
    "timestampSec" DECIMAL(10,3),
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'OPEN',
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_comments_projectId_createdAt_idx" ON "project_comments"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_comments_projectId_status_idx" ON "project_comments"("projectId", "status");

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "project_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
