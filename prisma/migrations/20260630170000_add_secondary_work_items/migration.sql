-- CreateEnum
CREATE TYPE "SecondaryWorkItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "SecondaryWorkItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" "SecondaryWorkItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondaryWorkItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WorkLog" ADD COLUMN "secondaryWorkItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SecondaryWorkItem_normalizedName_key" ON "SecondaryWorkItem"("normalizedName");
CREATE INDEX "SecondaryWorkItem_status_lastActivityAt_idx" ON "SecondaryWorkItem"("status", "lastActivityAt");
CREATE INDEX "SecondaryWorkItem_createdById_idx" ON "SecondaryWorkItem"("createdById");
CREATE INDEX "WorkLog_secondaryWorkItemId_idx" ON "WorkLog"("secondaryWorkItemId");

-- AddForeignKey
ALTER TABLE "SecondaryWorkItem" ADD CONSTRAINT "SecondaryWorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_secondaryWorkItemId_fkey" FOREIGN KEY ("secondaryWorkItemId") REFERENCES "SecondaryWorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
