ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_GIT';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'IN_DEV_BRANCH';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DOCKER';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DOCKERIZED';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DEPLOYED';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TYPE "ProjectDifficulty" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "DeployEnvironment" AS ENUM ('LOCAL', 'DEV', 'TEST', 'PROD');
CREATE TYPE "DeployStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

ALTER TABLE "Project"
  ADD COLUMN "year" INTEGER NOT NULL DEFAULT 2026,
  ADD COLUMN "difficulty" "ProjectDifficulty" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "deadline" TIMESTAMP(3),
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "repositoryApiUrl" TEXT,
  ADD COLUMN "repositoryWebUrl" TEXT,
  ADD COLUMN "branch" TEXT,
  ADD COLUMN "techStack" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE TABLE "Deployment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environment" "DeployEnvironment" NOT NULL,
  "status" "DeployStatus" NOT NULL DEFAULT 'PENDING',
  "apiCommit" TEXT,
  "webCommit" TEXT,
  "apiRepoUrl" TEXT,
  "webRepoUrl" TEXT,
  "server" TEXT,
  "deployedById" TEXT,
  "notes" TEXT,
  "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_year_idx" ON "Project"("year");
CREATE INDEX "Project_difficulty_idx" ON "Project"("difficulty");
CREATE INDEX "Project_deadline_idx" ON "Project"("deadline");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Deployment_projectId_deployedAt_idx" ON "Deployment"("projectId", "deployedAt");
CREATE INDEX "Deployment_environment_status_idx" ON "Deployment"("environment", "status");
CREATE INDEX "Deployment_deployedById_idx" ON "Deployment"("deployedById");

ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_deployedById_fkey" FOREIGN KEY ("deployedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
