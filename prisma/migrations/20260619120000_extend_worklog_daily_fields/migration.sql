ALTER TYPE "WorkLogMode" ADD VALUE IF NOT EXISTS 'MIXED';

ALTER TABLE "WorkLog"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "activityType" "ActivityType" NOT NULL DEFAULT 'PROJECT',
ADD COLUMN "hours" DOUBLE PRECISION;

ALTER TABLE "WorkLog"
ADD CONSTRAINT "WorkLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WorkLog_projectId_idx" ON "WorkLog"("projectId");
CREATE INDEX "WorkLog_activityType_idx" ON "WorkLog"("activityType");
CREATE INDEX "WorkLog_mode_idx" ON "WorkLog"("mode");
