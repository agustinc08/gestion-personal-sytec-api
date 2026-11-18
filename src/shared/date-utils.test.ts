import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { argentinaDayRange, argentinaMonthRange, parseArgentinaDateOnly } from './date-utils';

describe('Argentina date-only ranges', () => {
  it('uses Buenos Aires midnight as the inclusive day start and next midnight as the exclusive end', () => {
    const { start, end } = argentinaDayRange('2026-11-17');
    assert.equal(start.toISOString(), '2026-11-17T03:00:00.000Z');
    assert.equal(end.toISOString(), '2026-11-18T03:00:00.000Z');
  });

  it('handles year boundaries when calculating a month range', () => {
    const { start, end } = argentinaMonthRange(2026, 12);
    assert.equal(start.toISOString(), '2026-12-01T03:00:00.000Z');
    assert.equal(end.toISOString(), '2027-01-01T03:00:00.000Z');
  });

  it('accepts valid date-only values and rejects impossible dates', () => {
    assert.equal(parseArgentinaDateOnly('2026-02-28'), '2026-02-28');
    assert.equal(parseArgentinaDateOnly('2026-02-30'), '');
  });
});
