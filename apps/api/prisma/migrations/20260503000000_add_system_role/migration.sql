-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'MOD', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'USER';
