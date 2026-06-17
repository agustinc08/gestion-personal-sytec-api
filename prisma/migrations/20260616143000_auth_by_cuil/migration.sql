-- Make CUIL the primary login identifier for users.
ALTER TABLE "User" ADD COLUMN "cuil" TEXT;

UPDATE "User" AS u
SET "cuil" = regexp_replace(COALESCE(e."cuil", u."legacyId", u."id"), '\D', '', 'g')
FROM "Employee" AS e
WHERE u."employeeId" = e."id";

UPDATE "User"
SET "cuil" = 'legacy-' || "id"
WHERE "cuil" IS NULL OR "cuil" = '';

UPDATE "Employee"
SET "cuil" = COALESCE(NULLIF(regexp_replace(COALESCE("cuil", ''), '\D', '', 'g'), ''), 'legacy-' || "id")
WHERE "cuil" IS NULL OR "cuil" = '';

ALTER TABLE "User" ALTER COLUMN "cuil" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "cuil" SET NOT NULL;

CREATE UNIQUE INDEX "User_cuil_key" ON "User"("cuil");
