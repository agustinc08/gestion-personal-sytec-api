CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dependency_name_key" ON "Dependency"("name");
CREATE INDEX "Dependency_isActive_deletedAt_idx" ON "Dependency"("isActive", "deletedAt");

ALTER TABLE "Employee" ADD COLUMN "dependencyId" TEXT;

INSERT INTO "Dependency" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT 'dep_' || md5(trim("dependency")), trim("dependency"), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Employee"
WHERE trim("dependency") <> ''
GROUP BY trim("dependency")
ON CONFLICT ("name") DO NOTHING;

UPDATE "Employee" employee
SET "dependencyId" = dependency."id"
FROM "Dependency" dependency
WHERE lower(trim(employee."dependency")) = lower(trim(dependency."name"));

CREATE INDEX "Employee_dependencyId_idx" ON "Employee"("dependencyId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
