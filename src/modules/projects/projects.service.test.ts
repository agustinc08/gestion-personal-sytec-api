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
});
