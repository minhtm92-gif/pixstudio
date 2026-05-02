-- Sprint 6 — Tier quota tracker + Crossian RAG documents

-- CreateTable: usage_trackers
CREATE TABLE "usage_trackers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "buildsCount" INTEGER NOT NULL DEFAULT 0,
    "pathBMinutes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "voicePreviewsCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_trackers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_trackers_workspaceId_monthYear_key" ON "usage_trackers"("workspaceId", "monthYear");
CREATE INDEX "usage_trackers_workspaceId_idx" ON "usage_trackers"("workspaceId");

-- CreateTable: rag_documents (Crossian sanitized content)
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "workflowTags" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "content" TEXT NOT NULL,
    "sanitizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sanitizeRules" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rag_documents_contentType_idx" ON "rag_documents"("contentType");

-- pgvector embedding column added separately via raw SQL (Prisma vector type
-- requires manual ALTER). Sprint 6 polish: add embedding column + ivfflat index.
-- ALTER TABLE "rag_documents" ADD COLUMN "embedding" vector(1536);
-- CREATE INDEX ON "rag_documents" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
