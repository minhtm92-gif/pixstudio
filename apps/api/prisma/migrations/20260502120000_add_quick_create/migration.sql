-- CreateEnum
CREATE TYPE "QuickCreateMode" AS ENUM ('PATH_A', 'PATH_B');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('PENDING', 'GENERATING_SCRIPT', 'SYNTHESIZING_VOICE', 'MATCHING_STOCK', 'COMPOSING_SCENES', 'RENDERING_PREVIEW', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "quick_create_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowId" TEXT,
    "prompt" TEXT NOT NULL,
    "mode" "QuickCreateMode" NOT NULL DEFAULT 'PATH_A',
    "pathBSourceJson" JSONB,
    "configOverrides" JSONB NOT NULL DEFAULT '{}',
    "outlineJson" JSONB,
    "chipSelectionsJson" JSONB,
    "buildJobId" TEXT,
    "buildStatus" "BuildStatus" NOT NULL DEFAULT 'PENDING',
    "buildProgress" INTEGER NOT NULL DEFAULT 0,
    "buildErrorMessage" TEXT,
    "projectId" TEXT,
    "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "quick_create_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_create_sessions_userId_idx" ON "quick_create_sessions"("userId");

-- CreateIndex
CREATE INDEX "quick_create_sessions_workspaceId_idx" ON "quick_create_sessions"("workspaceId");

-- CreateIndex
CREATE INDEX "quick_create_sessions_workflowId_idx" ON "quick_create_sessions"("workflowId");

-- CreateIndex
CREATE INDEX "quick_create_sessions_buildStatus_idx" ON "quick_create_sessions"("buildStatus");

-- AddForeignKey
ALTER TABLE "quick_create_sessions" ADD CONSTRAINT "quick_create_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
