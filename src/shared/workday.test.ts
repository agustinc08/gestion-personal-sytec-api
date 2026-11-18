import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { currentRemoteDays, getWorkdayStatus, normalizeRemoteDays, requiresWorkLog } from './workday';

describe('workday status', () => {
  it('classifies remote and presential weekdays', () => {
    assert.equal(getWorkdayStatus({ date: '2026-11-16', remoteDays: ['Lunes'] }), 'REMOTE');
    assert.equal(getWorkdayStatus({ date: '2026-11-16', remoteDays: [] }), 'PRESENTIAL');
  });
  it('excludes weekends and configured strike dates', () => {
    assert.equal(getWorkdayStatus({ date: '2026-11-21' }), 'WEEKEND');
    assert.equal(getWorkdayStatus({ date: '2026-11-22' }), 'WEEKEND');
    assert.equal(getWorkdayStatus({ date: '2026-11-20', strikeDate: '2026-11-20' }), 'STRIKE');
    assert.equal(getWorkdayStatus({ date: '2026-11-21', strikeDate: '2026-11-21' }), 'STRIKE');
  });
  it('requires work logs only on working days', () => {
    assert.equal(requiresWorkLog('WEEKEND'), false);
    assert.equal(requiresWorkLog('STRIKE'), false);
    assert.equal(requiresWorkLog('REMOTE'), true);
    assert.equal(requiresWorkLog('PRESENTIAL'), true);
  });
  it('uses only undated remote day rows and normalizes the update', () => {
    assert.deepEqual(currentRemoteDays([
      { day: ' Lunes ', date: null },
      { day: 'Martes', date: new Date('2026-11-17T12:00:00Z') },
      { day: 'Miércoles', date: null },
    ]), ['Lunes', 'Miércoles']);
    assert.deepEqual(normalizeRemoteDays([' Jueves', 'Martes ', 'Jueves']), ['Jueves', 'Martes']);
  });
});
