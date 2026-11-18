import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SecondaryWorkItemsService } from './secondary-work-items.service';

describe('secondary work item authorization', () => {
  it('scopes employee lists and nested log includes to the current employee', async () => {
    let args: any;
    const prisma = { secondaryWorkItem: { findMany: async (query: any) => { args = query; return []; } } };
    const service = new SecondaryWorkItemsService(prisma as any);
    await service.findAll({ id: 'u-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'emp-a' });
    assert.deepEqual(args.where, { workLogs: { some: { employeeId: 'emp-a', deletedAt: null } } });
    assert.equal(args.include.workLogs.where.employeeId, 'emp-a');
  });

  it('does not return another employee logs when an ID is guessed', async () => {
    let query: any;
    const prisma = {
      secondaryWorkItem: { findUnique: async () => ({ id: 'item-b' }) },
      workLog: { findMany: async (args: any) => { query = args; return []; } },
    };
    const service = new SecondaryWorkItemsService(prisma as any);
    await assert.rejects(
      service.workLogs('item-b', { id: 'u-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'emp-a' }),
      NotFoundException,
    );
    assert.equal(query.where.employeeId, 'emp-a');
  });

  it('keeps global access for ADMIN', async () => {
    let query: any;
    const prisma = {
      secondaryWorkItem: { findUnique: async () => ({ id: 'item-b' }) },
      workLog: { findMany: async (args: any) => { query = args; return []; } },
    };
    const service = new SecondaryWorkItemsService(prisma as any);
    await service.workLogs('item-b', { id: 'admin', cuil: '', role: Role.ADMIN });
    assert.equal(query.where.employeeId, undefined);
  });

  it('keeps employee authorization scope when listing a server page', async () => {
    let query: any;
    const prisma = {
      secondaryWorkItem: {
        findMany: async (args: any) => { query = args; return []; },
        count: async (args: any) => { assert.deepEqual(args.where, query.where); return 3; },
      },
    };
    const service = new SecondaryWorkItemsService(prisma as any);
    const result = await service.findAll({ id: 'u-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'emp-a' }, { page: '2', pageSize: '1' });
    assert.deepEqual(query.where, { workLogs: { some: { employeeId: 'emp-a', deletedAt: null } } });
    assert.equal(query.skip, 1);
    assert.equal(query.take, 1);
    assert.deepEqual(result, { items: [], page: 2, pageSize: 1, total: 3, totalPages: 3 });
  });

  it('returns only lightweight secondary options scoped to the employee', async () => {
    let query: any;
    const prisma = { secondaryWorkItem: { findMany: async (args: any) => { query = args; return [{ id: 'item-1', name: 'Soporte', status: 'ACTIVE' }]; } } };
    const service = new SecondaryWorkItemsService(prisma as any);
    const options = await service.findOptions({ id: 'u-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'emp-a' });
    assert.deepEqual(query.where, { workLogs: { some: { employeeId: 'emp-a', deletedAt: null } } });
    assert.deepEqual(query.select, { id: true, name: true, status: true });
    assert.deepEqual(options, [{ id: 'item-1', name: 'Soporte', status: 'ACTIVE' }]);
  });
});
