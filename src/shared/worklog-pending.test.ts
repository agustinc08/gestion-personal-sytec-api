import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { approvedLeaveEmployeeIdsForDate, pendingWorkLogEmployeeIds } from './worklog-pending';

describe('daily pending work log calculation', () => {
  const employees = [
    { id: 'onsite', remoteDays: [] },
    { id: 'remote', remoteDays: ['Martes'] },
    { id: 'leave', remoteDays: [] },
  ];

  it('counts employees, not work log rows, and treats remote as a working day', () => {
    assert.deepEqual(pendingWorkLogEmployeeIds({
      date: '2026-11-17',
      employees,
      employeeIdsWithLogs: ['onsite', 'onsite'],
      employeeIdsOnApprovedLeave: [],
    }), ['remote', 'leave']);
  });

  it('excludes weekends, strike days and approved leave', () => {
    assert.deepEqual(pendingWorkLogEmployeeIds({
      date: '2026-11-21',
      employees,
      employeeIdsWithLogs: [],
      employeeIdsOnApprovedLeave: [],
    }), []);
    assert.deepEqual(pendingWorkLogEmployeeIds({
      date: '2026-11-17',
      strikeDate: '2026-11-17',
      employees,
      employeeIdsWithLogs: [],
      employeeIdsOnApprovedLeave: [],
    }), []);
    assert.deepEqual(pendingWorkLogEmployeeIds({
      date: '2026-11-17',
      employees,
      employeeIdsWithLogs: [],
      employeeIdsOnApprovedLeave: ['onsite', 'remote', 'leave'],
    }), []);
  });

  it('treats an approved leave range as inclusive', () => {
    const leaveIds = approvedLeaveEmployeeIdsForDate([
      { employeeId: 'e1', startDate: new Date('2026-11-16T03:00:00Z'), endDate: new Date('2026-11-18T03:00:00Z') },
    ], new Date('2026-11-17T03:00:00Z'));
    assert.deepEqual(leaveIds, ['e1']);
  });

  it('does not treat a Guardia en Feria credit as leave', () => {
    const rows = [{ employeeId: 'e1', article: 'Guardia en Feria', startDate: new Date('2026-11-17T03:00:00Z'), endDate: new Date('2026-11-17T03:00:00Z') }];
    assert.deepEqual(approvedLeaveEmployeeIdsForDate(rows, new Date('2026-11-17T03:00:00Z')), []);
  });
});
