-- CreateEnum: Stock library
CREATE TYPE "StockVendor" AS ENUM ('ISTOCK', 'ENVATO', 'SHUTTERSTOCK');
CREATE TYPE "StockAccountStatus" AS ENUM ('ACTIVE', 'RATE_LIMITED', 'EXPIRED', 'DISABLED');

-- CreateTable: stock_accounts
CREATE TABLE "stock_accounts" (
    "id" TEXT NOT NULL,
    "vendor" "StockVendor" NOT NULL,
    "label" TEXT NOT NULL,
    "apiCredentialsKey" TEXT NOT NULL,
    "monthlyQuota" INTEGER NOT NULL,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "resetDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "status" "StockAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_accounts_vendor_status_idx" ON "stock_accounts"("vendor", "status");

-- CreateTable: stock_downloads
CREATE TABLE "stock_downloads" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "vendorAssetId" TEXT NOT NULL,
    "vendorPreviewUrl" TEXT,
    "vendorLicenseId" TEXT,
    "r2Key" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_downloads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_downloads_accountId_createdAt_idx" ON "stock_downloads"("accountId", "createdAt");
CREATE INDEX "stock_downloads_workspaceId_idx" ON "stock_downloads"("workspaceId");

ALTER TABLE "stock_downloads" ADD CONSTRAINT "stock_downloads_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "stock_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum: Reverse Engineer
CREATE TYPE "ReverseEngineerStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'EXTRACTING_AUDIO', 'DETECTING_SCENES', 'SEPARATING_STEMS', 'TRANSCRIBING', 'IDENTIFYING_MUSIC', 'ANALYZING_VISUAL', 'BUILDING_STATE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable: reverse_engineer_jobs
CREATE TABLE "reverse_engineer_jobs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceAssetId" TEXT,
    "gpuDropletId" TEXT,
    "status" "ReverseEngineerStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "outputEditorStateJson" JSONB,
    "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "reverse_engineer_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reverse_engineer_jobs_sessionId_key" ON "reverse_engineer_jobs"("sessionId");
CREATE INDEX "reverse_engineer_jobs_userId_idx" ON "reverse_engineer_jobs"("userId");
CREATE INDEX "reverse_engineer_jobs_status_idx" ON "reverse_engineer_jobs"("status");
