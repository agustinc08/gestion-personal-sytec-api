import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkLogsService } from './work-logs.service';

describe('work log project authorization', () => {
  it('allows an employee assigned to the project', async () => {
    const prisma = { project: { findFirst: async (query: any) => ({ id: query.where.id }) } };
    const service = new WorkLogsService(prisma as any, {} as any, {} as any);
    await assert.doesNotReject((service as any).assertProjectAccess('project-a', { role: Role.EMPLOYEE, employeeId: 'employee-a' }));
  });

  it('rejects an employee who is not assigned to the project', async () => {
    const prisma = { project: { findFirst: async () => null } };
    const service = new WorkLogsService(prisma as any, {} as any, {} as any);
    await assert.rejects((service as any).assertProjectAccess('project-b', { role: Role.EMPLOYEE, employeeId: 'employee-a' }), ForbiddenException);
  });

  it('preserves the administrator bypass', async () => {
    const prisma = { project: { findFirst: async () => { throw new Error('must not query'); } } };
    const service = new WorkLogsService(prisma as any, {} as any, {} as any);
    await assert.doesNotReject((service as any).assertProjectAccess('project-a', { role: Role.ADMIN }));
  });
});
