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
      $queryRaw: async () => [],
    };
    const service = new EmployeesService(prisma as any, {} as any);
    const page = await service.findAll({ page: '2', pageSize: '5', q: 'Ada', dependencyId: 'dep-1' });
    assert.equal(query.where.dependencyId, 'dep-1');
    assert.equal(query.where.OR.length, 4);
    assert.equal(query.skip, 5);
    assert.equal(query.take, 5);
    assert.deepEqual(page, { items: [], page: 2, pageSize: 5, total: 0, totalPages: 1 });
  });

  it('returns lightweight options and aggregates consumed license days without loading license rows', async () => {
    let query: any;
    const prisma = {
      employee: { findMany: async (args: any) => { query = args; return [{ id: 'emp-1', name: 'Ada', dependency: 'Sistemas', dependencyId: 'dep-1', position: 'Analista', compensatoryDays: 2, totalLicenseDays: 20, strikeDutyOrder: 1, cuil: '20123456789', user: { role: 'EMPLOYEE' }, remoteDays: [{ day: 'Lunes' }], dependencyRef: { name: 'Sistemas' } }]; } },
      $queryRaw: async () => [{ employeeId: 'emp-1', daysTaken: 4 }],
    };
    const service = new EmployeesService(prisma as any, {} as any);
    const options = await service.findOptions();
    assert.equal(query.select.licenseRequests, undefined);
    assert.equal(query.select.remoteDays.where.date, null);
    assert.deepEqual(options.map((row: any) => ({ id: row.id, name: row.name, licenseDaysTaken: row.licenseDaysTaken, remoteDaysAssigned: row.remoteDaysAssigned })), [
      { id: 'emp-1', name: 'Ada', licenseDaysTaken: 4, remoteDaysAssigned: ['Lunes'] },
    ]);
  });
});
