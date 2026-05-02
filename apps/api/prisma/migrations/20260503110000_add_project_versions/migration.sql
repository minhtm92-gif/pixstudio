-- AlterTable: editor state on Project
ALTER TABLE "projects" ADD COLUMN "editorStateJson" JSONB;
ALTER TABLE "projects" ADD COLUMN "editorStateVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: ProjectVersion
CREATE TABLE "project_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "editorStateJson" JSONB NOT NULL,
    "label" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "triggerReason" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_versions_projectId_versionNumber_key" ON "project_versions"("projectId", "versionNumber");
CREATE INDEX "project_versions_projectId_createdAt_idx" ON "project_versions"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
