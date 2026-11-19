import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { LicenseStatus, Role } from '@prisma/client';
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

  it('paginates /my using numeric Prisma values and the employee from the JWT', async () => {
    let args: any;
    const prisma = {
      licenseRequest: {
        findMany: async (value: any) => { args = value; return []; },
        count: async () => 0,
      },
    };
    const service = new LicensesService(prisma as any, {} as any);
    const result = await service.findMine(
      { id: 'user-1', role: Role.EMPLOYEE, employeeId: 'employee-auth' } as any,
      { page: '2', pageSize: '25', employeeId: 'employee-other', status: 'aprobado' },
    );
    assert.equal(args.skip, 25);
    assert.equal(args.take, 25);
    assert.equal(args.where.employeeId, 'employee-auth');
    assert.equal(args.where.status, LicenseStatus.APPROVED);
    assert.equal(Array.isArray(result), false);
    assert.equal((result as any).page, 2);
  });

  it('rejects unknown status filters as 400 instead of silently changing their meaning', async () => {
    const service = new LicensesService({} as any, {} as any);
    await assert.rejects(service.findMine({ role: Role.EMPLOYEE, employeeId: 'employee-auth' } as any, { status: 'not-a-status' }), BadRequestException);
  });

  it('rejects impossible date filters before calling Prisma', async () => {
    let called = false;
    const service = new LicensesService({ licenseRequest: { findMany: async () => { called = true; return []; } } } as any, {} as any);
    await assert.rejects(service.findMine({ role: Role.EMPLOYEE, employeeId: 'employee-auth' } as any, { from: '2026-11-01', to: '2026-11-31' }), BadRequestException);
    assert.equal(called, false);
  });
});
