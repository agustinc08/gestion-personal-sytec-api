import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Role } from '@prisma/client';
import { StrikeService } from './strike.service';

describe('remote day endpoint authorization', () => {
  it('limits employee queries to their own remote configuration', async () => {
    let query: any;
    const service = new StrikeService({ remoteDay: { findMany: async (value: any) => { query = value; return []; } } } as any, {} as any);
    await service.remoteDays({ id: 'user-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'employee-a' });
    assert.deepEqual(query.where, { employeeId: 'employee-a' });
  });

  it('fails closed if an employee has no linked employee record', async () => {
    let query: any;
    const service = new StrikeService({ remoteDay: { findMany: async (value: any) => { query = value; return []; } } } as any, {} as any);
    await service.remoteDays({ id: 'user-a', cuil: '', role: Role.EMPLOYEE });
    assert.notDeepEqual(query.where, {});
  });

  it('retains global access for administrators', async () => {
    let query: any;
    const service = new StrikeService({ remoteDay: { findMany: async (value: any) => { query = value; return []; } } } as any, {} as any);
    await service.remoteDays({ id: 'admin', cuil: '', role: Role.ADMIN });
    assert.deepEqual(query.where, {});
  });
});
