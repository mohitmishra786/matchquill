import { describe, it, expect } from 'vitest';
import { concurrencyWhere, isSameVersion } from '../atomic-update';

describe('concurrencyWhere', () => {
  it('includes updatedAt when provided', () => {
    const d = new Date('2020-01-01T00:00:00.000Z');
    expect(concurrencyWhere('abc', d)).toEqual({ id: 'abc', updatedAt: d });
  });
  it('id only without version', () => {
    expect(concurrencyWhere('abc')).toEqual({ id: 'abc' });
  });
});

describe('isSameVersion', () => {
  it('compares timestamps', () => {
    const t = '2020-01-01T00:00:00.000Z';
    expect(isSameVersion(t, t)).toBe(true);
    expect(isSameVersion(t, '2021-01-01T00:00:00.000Z')).toBe(false);
  });
});
