import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LicensesService } from './licenses.service';

describe('license server pagination filters', () => {
  it('includes employee identity in server-side q while retaining status and date filters', async () => {
    let query: any;
    const prisma = {
      licenseRequest: {
        findMany: async (args: any) => { query = args; return []; },
        count: async ({ where }: any) => { assert.deepEqual(where, query.where); return 0; },
      },
    };
    const service = new LicensesService(prisma as any, {} as any);
    const page = await service.findAll({ page: '1', pageSize: '25', q: 'Ada', status: 'pendiente', from: '2026-11-01', to: '2026-11-30' });
    assert.ok(query.where.OR.some((condition: any) => condition.employee?.is?.name?.contains === 'Ada'));
    assert.equal(query.where.startDate.gte.toISOString(), '2026-11-01T03:00:00.000Z');
    assert.equal(query.skip, 0);
    assert.equal(query.take, 25);
    assert.equal((page as any).total, 0);
  });
});
