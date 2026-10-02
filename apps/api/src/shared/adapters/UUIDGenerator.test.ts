import { describe, it, expect } from 'vitest';
import { UUIDGenerator } from './UUIDGenerator';

describe('UUIDGenerator', () => {
  it('should generate a valid UUID', () => {
    const generator = new UUIDGenerator();
    const id = generator.generate();

    // Basic regex for UUID v4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const generator = new UUIDGenerator();
    const id1 = generator.generate();
    const id2 = generator.generate();

    expect(id1).not.toBe(id2);
  });
});
