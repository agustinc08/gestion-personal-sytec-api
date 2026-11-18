import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('project server pagination filters', () => {
  it('keeps lifecycle and exact status filters, owner, deadline, and q server-side', async () => {
    let query: any;
    const prisma = {
      project: {
        findMany: async (args: any) => { query = args; return []; },
        count: async ({ where }: any) => { assert.deepEqual(where, query.where); return 0; },
      },
    };
    const service = new ProjectsService(prisma as any, {} as any);
    const page = await service.findAll({ id: 'admin', role: Role.ADMIN } as any, {
      page: '2', pageSize: '10', q: 'Portal', status: 'vigente', lifecycle: 'active', ownerId: 'none', deadlineStatus: 'sin_fecha', needsRedesign: 'false', needsRework: 'true',
    });
    assert.equal(query.where.name.contains, 'Portal');
    assert.equal(query.where.ownerId, null);
    assert.equal(query.where.deadline, null);
    assert.ok(query.where.AND.some((condition: any) => condition.status));
    assert.ok(query.where.AND.some((condition: any) => condition.needsRedesign === false && condition.status.not));
    assert.ok(query.where.AND.some((condition: any) => condition.OR?.some((or: any) => or.needsRework === true)));
    assert.equal(query.skip, 10);
    assert.equal(query.take, 10);
    assert.equal((page as any).totalPages, 1);
  });

  it('returns access-scoped project options without heavy relations and with a worklog count', async () => {
    let query: any;
    const prisma = { project: { findMany: async (args: any) => { query = args; return [{ id: 'project-1', name: 'Portal', status: 'ACTIVE', year: 2026, deadline: null, ownerId: null, assignedEmployees: [{ id: 'emp-1' }], _count: { workLogs: 3 } }]; } } };
    const service = new ProjectsService(prisma as any, {} as any);
    const options = await service.findOptions({ id: 'user-1', cuil: '', role: Role.EMPLOYEE, employeeId: 'emp-1' });
    assert.deepEqual(query.where, { deletedAt: null, assignedEmployees: { some: { id: 'emp-1' } } });
    assert.equal(query.select.updates, undefined);
    assert.equal(query.select.deployments, undefined);
    assert.equal(options[0].workLogsCount, 3);
  });
});
