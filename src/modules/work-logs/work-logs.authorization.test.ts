import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { validate } from 'class-validator';
import { addDateOnlyDays, getArgentinaTodayDateOnly } from '../../shared/date-utils';
import { toDate } from '../../shared/mappers';
import { isEmployeeWorkLogDateEditable, WorkLogsService } from './work-logs.service';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';

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

describe('employee work log editing', () => {
  const today = getArgentinaTodayDateOnly();
  const employee = { id: 'employee-a', employeeId: 'employee-a', role: Role.EMPLOYEE };
  const baseLog = () => ({
    id: 'log-a', employeeId: 'employee-a', projectId: null, secondaryWorkItemId: null,
    title: 'Work', description: 'Before', date: toDate(today)!, mode: 'ONSITE',
    activityType: 'PROJECT', hours: 3, entryTime: null, exitTime: null, deletedAt: null,
    project: null, secondaryWorkItem: null,
  });
  const setup = (log = baseLog(), assigned = true) => {
    const audit = { record: async (...args: any[]) => auditCalls.push(args) };
    const auditCalls: any[] = [];
    let updateCalls = 0;
    const prisma = {
      workLog: {
        findFirst: async () => ({ ...log }),
        update: async ({ data }: any) => { updateCalls++; Object.assign(log, data); return { ...log }; },
      },
      project: { findFirst: async () => assigned ? { id: 'project-a' } : null },
    };
    const service = new WorkLogsService(prisma as any, audit as any, { findOrCreateByName: async () => ({ id: 'secondary-a' }), touch: async () => undefined } as any);
    return { service, log, auditCalls, get updateCalls() { return updateCalls; } };
  };

  it('defines the seven-date window as today through today minus six', () => {
    assert.equal(isEmployeeWorkLogDateEditable(today, today), true);
    assert.equal(isEmployeeWorkLogDateEditable(addDateOnlyDays(today, -6), today), true);
    assert.equal(isEmployeeWorkLogDateEditable(addDateOnlyDays(today, -7), today), false);
    assert.equal(isEmployeeWorkLogDateEditable(addDateOnlyDays(today, 1), today), false);
  });

  it('rejects employeeId as a non-whitelisted update field', async () => {
    const dto = Object.assign(new UpdateWorkLogDto(), { employeeId: 'employee-b' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    assert.ok(errors.some((error) => error.property === 'employeeId'));
  });

  it('allows an employee to edit their own recent work log and audits before/after', async () => {
    const ctx = setup();
    await ctx.service.update('log-a', { description: 'After' } as any, employee as any);
    assert.equal(ctx.updateCalls, 1);
    assert.equal(ctx.auditCalls[0][0], employee);
    assert.equal(ctx.auditCalls[0][1].action, 'WORKLOG_UPDATED_BY_EMPLOYEE');
    assert.equal(ctx.auditCalls[0][1].entityId, 'log-a');
    assert.equal(ctx.auditCalls[0][1].metadata.before.description, 'Before');
    assert.equal(ctx.auditCalls[0][1].metadata.after.description, 'After');
  });

  it('rejects editing another employee work log', async () => {
    const ctx = setup({ ...baseLog(), employeeId: 'employee-b' });
    await assert.rejects(ctx.service.update('log-a', { description: 'After' } as any, employee as any), ForbiddenException);
    assert.equal(ctx.updateCalls, 0);
    assert.equal(ctx.auditCalls.length, 0);
  });

  it('rejects a recent work log moved outside the window or into the future', async () => {
    const ctx = setup();
    await assert.rejects(ctx.service.update('log-a', { date: addDateOnlyDays(today, -7) } as any, employee as any), BadRequestException);
    await assert.rejects(ctx.service.update('log-a', { date: addDateOnlyDays(today, 1) } as any, employee as any), BadRequestException);
    assert.equal(ctx.updateCalls, 0);
  });

  it('rejects employee edits of an old work log', async () => {
    const ctx = setup({ ...baseLog(), date: toDate(addDateOnlyDays(today, -7))! });
    await assert.rejects(ctx.service.update('log-a', { description: 'After' } as any, employee as any), BadRequestException);
    assert.equal(ctx.updateCalls, 0);
  });

  it('keeps administrator historical editing and reason requirement', async () => {
    const ctx = setup({ ...baseLog(), date: toDate(addDateOnlyDays(today, -30))! });
    await assert.rejects(ctx.service.update('log-a', { description: 'After' } as any, { role: Role.ADMIN } as any), BadRequestException);
    await ctx.service.update('log-a', { description: 'After', reason: 'Correction requested' } as any, { role: Role.ADMIN } as any);
    assert.equal(ctx.updateCalls, 1);
    assert.equal(ctx.auditCalls[0][1].action, 'UPDATE');
  });

  it('does not update or audit an unchanged work log', async () => {
    const ctx = setup();
    await ctx.service.update('log-a', { description: 'Before' } as any, employee as any);
    assert.equal(ctx.updateCalls, 0);
    assert.equal(ctx.auditCalls.length, 0);
  });

  it('rechecks project assignment on employee edits', async () => {
    const ctx = setup(baseLog(), false);
    await assert.rejects(ctx.service.update('log-a', { projectId: 'project-a' } as any, employee as any), ForbiddenException);
    assert.equal(ctx.updateCalls, 0);
    assert.equal(ctx.auditCalls.length, 0);
  });
});
