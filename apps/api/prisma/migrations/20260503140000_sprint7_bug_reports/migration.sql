-- Sprint 7 — Internal alpha bug bash

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'DUPLICATE');

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL DEFAULT 'P2',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "consoleErrors" TEXT,
    "screenshotR2Key" TEXT,
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bug_reports_reporterId_idx" ON "bug_reports"("reporterId");
CREATE INDEX "bug_reports_status_severity_idx" ON "bug_reports"("status", "severity");
