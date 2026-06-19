CREATE TYPE "LicenseFieldType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'MULTILINE');

CREATE TABLE "LicenseArticle" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "templatePdfPath" TEXT,
  "templatePdfName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicenseArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseArticleField" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "LicenseFieldType" NOT NULL DEFAULT 'TEXT',
  "page" INTEGER NOT NULL DEFAULT 1,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "fontSize" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "defaultValue" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicenseArticleField_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LicenseRequest" ADD COLUMN "articleId" TEXT;

CREATE UNIQUE INDEX "LicenseArticle_code_key" ON "LicenseArticle"("code");
CREATE INDEX "LicenseArticle_isActive_idx" ON "LicenseArticle"("isActive");
CREATE INDEX "LicenseArticleField_articleId_idx" ON "LicenseArticleField"("articleId");
CREATE UNIQUE INDEX "LicenseArticleField_articleId_key_key" ON "LicenseArticleField"("articleId", "key");
CREATE INDEX "LicenseRequest_articleId_idx" ON "LicenseRequest"("articleId");

ALTER TABLE "LicenseArticleField" ADD CONSTRAINT "LicenseArticleField_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "LicenseArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "LicenseArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
