import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveEmployeeCalendarDay } from './calendar-day';

describe('employee labor calendar', () => {
  const base = { date: '2026-11-18', today: '2026-11-18', approvedLeave: false, strike: false, remoteDays: ['Miércoles'], workLogLoaded: false };
  it('gives approved leave priority and excludes its pending part', () => {
    assert.deepEqual(resolveEmployeeCalendarDay({ ...base, approvedLeave: true }), { status: 'LEAVE', collision: false, workLogPending: false });
  });
  it('keeps a work log visible as a separate collision on leave, strike, or weekend', () => {
    assert.equal(resolveEmployeeCalendarDay({ ...base, approvedLeave: true, workLogLoaded: true }).collision, true);
    assert.equal(resolveEmployeeCalendarDay({ ...base, strike: true, workLogLoaded: true }).collision, true);
    assert.equal(resolveEmployeeCalendarDay({ ...base, date: '2026-11-21', workLogLoaded: true }).collision, true);
  });
  it('uses persisted historical modality and never applies current remote settings to the past', () => {
    assert.equal(resolveEmployeeCalendarDay({ ...base, date: '2026-11-17', today: '2026-11-18' }).status, 'UNKNOWN');
    assert.equal(resolveEmployeeCalendarDay({ ...base, date: '2026-11-17', today: '2026-11-18', workLogLoaded: true, workLogMode: 'remoto' }).status, 'REMOTE');
  });
});
