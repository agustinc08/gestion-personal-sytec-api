CREATE TYPE "AnnouncementType" AS ENUM ('GENERAL', 'STRIKE', 'SALARY', 'LICENSE', 'PROJECT', 'SYSTEM');
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "Employee" ADD COLUMN "compensatoryDays" INTEGER NOT NULL DEFAULT 0;
UPDATE "Employee" employee SET "compensatoryDays" = COALESCE((
  SELECT SUM(GREATEST(1, (license."endDate"::date - license."startDate"::date) + 1))::integer
  FROM "LicenseRequest" license
  WHERE license."employeeId" = employee."id" AND license."article" = 'Guardia en Feria' AND license."status" = 'APPROVED' AND license."deletedAt" IS NULL
), 0);

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL,
  "type" "AnnouncementType" NOT NULL DEFAULT 'GENERAL',
  "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  "targetRole" "Role", "targetDependencyId" TEXT, "targetEmployeeId" TEXT,
  "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "pinned" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3), CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnnouncementRead" (
  "id" TEXT NOT NULL, "announcementId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_isActive_startsAt_endsAt_idx" ON "Announcement"("isActive", "startsAt", "endsAt");
CREATE INDEX "Announcement_targetRole_idx" ON "Announcement"("targetRole");
CREATE INDEX "Announcement_targetDependencyId_idx" ON "Announcement"("targetDependencyId");
CREATE INDEX "Announcement_targetEmployeeId_idx" ON "Announcement"("targetEmployeeId");
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");
CREATE INDEX "AnnouncementRead_userId_readAt_idx" ON "AnnouncementRead"("userId", "readAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetDependencyId_fkey" FOREIGN KEY ("targetDependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
