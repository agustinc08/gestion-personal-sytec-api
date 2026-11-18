import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EmployeesService } from './employees.service';

describe('employee server pagination filters', () => {
  it('applies dependency and search filters before slicing results', async () => {
    let query: any;
    const prisma = {
      employee: {
        findMany: async (args: any) => { query = args; return []; },
        count: async ({ where }: any) => { assert.deepEqual(where, query.where); return 0; },
      },
    };
    const service = new EmployeesService(prisma as any, {} as any);
    const page = await service.findAll({ page: '2', pageSize: '5', q: 'Ada', dependencyId: 'dep-1' });
    assert.equal(query.where.dependencyId, 'dep-1');
    assert.equal(query.where.OR.length, 4);
    assert.equal(query.skip, 5);
    assert.equal(query.take, 5);
    assert.deepEqual(page, { items: [], page: 2, pageSize: 5, total: 0, totalPages: 1 });
  });
});
