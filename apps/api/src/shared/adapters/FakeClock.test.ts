import { describe, it, expect } from 'vitest';
import { FakeClock } from './FakeClock';

describe('FakeClock', () => {
  it('should return the initial time', () => {
    const initialTime = new Date('2024-01-01T10:00:00Z');
    const clock = new FakeClock(initialTime);

    expect(clock.now()).toEqual(initialTime);
  });

  it('should allow advancing time', () => {
    const initialTime = new Date('2024-01-01T10:00:00Z');
    const clock = new FakeClock(initialTime);

    clock.advance(5000); // advance 5 seconds

    const expectedTime = new Date('2024-01-01T10:00:05Z');
    expect(clock.now()).toEqual(expectedTime);
  });

  it('should allow setting a specific time', () => {
    const clock = new FakeClock();
    const newTime = new Date('2025-05-05T12:00:00Z');

    clock.setTime(newTime);

    expect(clock.now()).toEqual(newTime);
  });
});
