CREATE TYPE "ActivityType" AS ENUM ('PROJECT', 'SUPPORT', 'MAINTENANCE', 'DEPLOY', 'MEETING', 'DOCUMENTATION', 'OTHER');

ALTER TABLE "ProjectUpdate"
ADD COLUMN "activityType" "ActivityType" NOT NULL DEFAULT 'PROJECT';

CREATE INDEX "ProjectUpdate_activityType_idx" ON "ProjectUpdate"("activityType");
