import { describe, it, expect } from 'vitest';
import { SystemClock } from './SystemClock';

describe('SystemClock', () => {
  it('should return the current date and time', () => {
    const clock = new SystemClock();
    const before = new Date();
    const now = clock.now();
    const after = new Date();

    expect(now.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
