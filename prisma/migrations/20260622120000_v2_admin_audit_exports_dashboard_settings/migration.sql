ALTER TABLE "AuditLog"
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "module" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "detail" TEXT,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "userAgent" TEXT;

CREATE INDEX "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");
CREATE INDEX "AuditLog_module_action_idx" ON "AuditLog"("module", "action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
