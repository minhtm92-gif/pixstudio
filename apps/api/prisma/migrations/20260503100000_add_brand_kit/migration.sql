-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "logoR2Key" TEXT,
    "faviconR2Key" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "fontFamily" TEXT,
    "watermarkText" TEXT,
    "watermarkOn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_workspaceId_key" ON "brand_kits"("workspaceId");

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
